import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

import { loadEnvConfig } from "@next/env";
import { chromium, type Browser } from "playwright";
import { Pool } from "pg";

import {
    GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_FINGERPRINT,
    GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID,
    GOOGLE_CANDIDATE_QUESTION_WORDING_PROVIDER,
} from "../src/features/candidate-session-v2/google-candidate-question-wording";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const LIVE_BROWSER_FLAG = "CANDIDATE_QUESTION_WORDING_BROWSER_TEST";
const PRIMARY_CANDIDATE_PROFILE_ID = "10000000-0000-4000-8000-000000000001";

loadEnvConfig(process.cwd());
void main();

async function main() {
    let server: ReturnType<typeof startDevServer> | null = null;
    let browser: Browser | null = null;
    let sessionId: string | null = null;
    let roleProfileId: string | null = null;
    let createdTargetRole: string | null = null;
    const serverLog: string[] = [];
    const databaseUrl = getSmokeDatabaseUrl();
    const pool = new Pool({
        connectionString: databaseUrl,
        max: 2,
        application_name: "interview-coach-question-wording-browser-reconciliation",
    });

    try {
        assertGuardAccepted(process.argv.slice(2));
        await assertSeedCandidateExists(pool);
        const port = await findAvailablePort(3100);
        const baseUrl = `http://127.0.0.1:${port}`;
        const env = {
            ...process.env,
            DATABASE_URL: databaseUrl,
            CANDIDATE_DATA_BACKEND: "postgres",
            CANDIDATE_HOST_LAUNCH_DEV_MODE: "true",
            CANDIDATE_HOST_LAUNCH_DEV_SECRET: "question-wording-browser-reconciliation-secret",
            CANDIDATE_QUESTION_WORDING_PROVIDER: GOOGLE_CANDIDATE_QUESTION_WORDING_PROVIDER,
            CANDIDATE_QUESTION_WORDING_PROFILE: GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID,
            NEXT_PUBLIC_APP_URL: baseUrl,
            NEXT_PUBLIC_BASE_URL: baseUrl,
        };
        const startedServer = startDevServer(port, env, serverLog);
        server = startedServer;
        await waitForServer(baseUrl, startedServer);

        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.route("**/api/tts", async (route) => {
            await route.fulfill({ status: 204, body: "" });
        });

        const suffix = Date.now().toString(36);
        const targetRole = `Wording validation inspector ${suffix}`;
        createdTargetRole = targetRole;
        await page.goto(`${baseUrl}/candidate/dev/launch?candidate=primary&next=/candidate/setup`, {
            waitUntil: "domcontentloaded",
        });
        await page.waitForURL(/\/candidate\/setup(?:\?|$)/, { timeout: 30_000 });
        await page.getByRole("heading", { name: "Practice Setup" }).waitFor();
        await page.getByLabel("Target role *").fill(targetRole);
        await page.getByLabel("Job description *").fill(
            "Inspect finished goods, document defects, follow safety procedures, and communicate quality findings.",
        );
        await page.getByRole("button", { name: /screening call/i }).click();
        await page.getByRole("button", { name: "3", exact: true }).click();
        await page.getByRole("button", { name: /start practice/i }).click();
        await page.waitForURL(/\/candidate\/session\/[0-9a-f-]+(?:\?|$)/i, { timeout: 60_000 });

        sessionId = readSessionId(page.url());
        const persisted = await readPersistedSession(pool, sessionId);
        roleProfileId = persisted.roleProfileId;
        assert.equal(persisted.questionWordingStatus, "worded");
        assert.equal(persisted.wording.status, "questions_worded");
        assert.equal(persisted.wording.questions.length, 3);
        assert.equal(persisted.wording.generation?.provider, GOOGLE_CANDIDATE_QUESTION_WORDING_PROVIDER);
        assert.equal(persisted.wording.generation?.profileId, GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID);
        assert.equal(
            persisted.wording.generation?.configurationFingerprint,
            GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_FINGERPRINT,
        );

        await page.getByRole("heading", { name: "Your practice is ready." }).waitFor();
        await page.getByText(targetRole, { exact: true }).first().waitFor();
        await page.getByRole("button", { name: "Start practice", exact: true }).click();
        const firstQuestionText = persisted.wording.questions[0]?.questionText;
        assert(firstQuestionText);
        await page.getByRole("heading", { name: firstQuestionText, exact: true }).waitFor({ timeout: 30_000 });
        await waitForLiveQuestionProgress(pool, sessionId);

        const immutableSnapshot = JSON.stringify(persisted.wording);
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { name: firstQuestionText, exact: true }).waitFor({ timeout: 30_000 });
        const recovered = await readPersistedSession(pool, sessionId);
        assert.equal(JSON.stringify(recovered.wording), immutableSnapshot);

        process.stdout.write(`${JSON.stringify({
            status: "candidate_question_wording_browser_reconciliation_passed",
            database: "disposable_smoke",
            provider: GOOGLE_CANDIDATE_QUESTION_WORDING_PROVIDER,
            profileId: GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID,
            configurationFingerprint: GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_FINGERPRINT,
            questionCount: persisted.wording.questions.length,
            readyLandingRendered: true,
            firstGeneratedQuestionRendered: true,
            refreshRecoveredImmutableWording: true,
        }, null, 2)}\n`);
    } catch (error) {
        if (serverLog.length > 0) {
            process.stderr.write(`${serverLog.slice(-30).join("")}\n`);
        }
        throw error;
    } finally {
        if (browser) await browser.close().catch(() => undefined);
        if (createdTargetRole) {
            await pool.query(`
                delete from public.candidate_practice_sessions practice
                using public.candidate_role_preparation_profiles profile
                where practice.role_profile_id = profile.role_profile_id
                  and profile.candidate_profile_id = $1
                  and profile.target_role = $2
            `, [PRIMARY_CANDIDATE_PROFILE_ID, createdTargetRole]).catch(() => undefined);
        } else if (sessionId) {
            await pool.query("delete from public.candidate_practice_sessions where candidate_practice_session_id = $1", [sessionId])
                .catch(() => undefined);
        }
        if (createdTargetRole) {
            await pool.query(`
                delete from public.candidate_role_preparation_profiles
                where candidate_profile_id = $1
                  and target_role = $2
                  and not exists (
                    select 1
                    from public.candidate_practice_sessions
                    where role_profile_id = candidate_role_preparation_profiles.role_profile_id
                  )
            `, [PRIMARY_CANDIDATE_PROFILE_ID, createdTargetRole]).catch(() => undefined);
        } else if (roleProfileId) {
            await pool.query(`
                delete from public.candidate_role_preparation_profiles
                where role_profile_id = $1
                  and candidate_profile_id = $2
                  and not exists (
                    select 1 from public.candidate_practice_sessions where role_profile_id = $1
                  )
            `, [roleProfileId, PRIMARY_CANDIDATE_PROFILE_ID]).catch(() => undefined);
        }
        await pool.end();
        if (server) stopServer(server);
    }
}

function assertGuardAccepted(args: string[]) {
    assert(args.includes("--confirm-live-provider"), "Pass --confirm-live-provider to run the browser reconciliation.");
    assert.equal(process.env[LIVE_BROWSER_FLAG], "true", `${LIVE_BROWSER_FLAG}=true is required.`);
    assert(process.env.GEMINI_API_KEY?.trim(), "GEMINI_API_KEY is required.");
}

function startDevServer(port: number, env: NodeJS.ProcessEnv, serverLog: string[]) {
    const child = spawn(
        process.platform === "win32" ? "cmd.exe" : "npm",
        process.platform === "win32"
            ? ["/c", "npm", "run", "dev", "--", "-p", String(port)]
            : ["run", "dev", "--", "-p", String(port)],
        { env, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" },
    );
    child.stdout.on("data", (chunk) => appendLog(serverLog, chunk.toString()));
    child.stderr.on("data", (chunk) => appendLog(serverLog, chunk.toString()));
    return child;
}

async function waitForServer(baseUrl: string, server: ReturnType<typeof startDevServer>) {
    const deadline = Date.now() + 60_000;
    let lastError: unknown;
    while (Date.now() < deadline) {
        if (server.exitCode !== null) throw new Error(`Next dev server exited with code ${server.exitCode}.`);
        try {
            const response = await fetch(baseUrl);
            if (response.status < 500) return;
        } catch (error) {
            lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 750));
    }
    throw lastError ?? new Error("Next dev server did not become ready.");
}

function stopServer(server: ReturnType<typeof startDevServer>) {
    if (!server.pid) return;
    if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
        return;
    }
    try {
        process.kill(-server.pid, "SIGTERM");
    } catch {
        server.kill("SIGTERM");
    }
}

async function readPersistedSession(pool: Pool, candidatePracticeSessionId: string) {
    const result = await pool.query<{
        role_profile_id: string | null;
        question_wording_status: string;
        question_wording_snapshot_json: {
            status: string;
            questions: Array<{ questionText: string }>;
            generation?: {
                provider?: string;
                profileId?: string;
                configurationFingerprint?: string;
            };
        };
    }>(`
        select role_profile_id, question_wording_status, question_wording_snapshot_json
        from public.candidate_practice_sessions
        where candidate_practice_session_id = $1
          and candidate_profile_id = $2
    `, [candidatePracticeSessionId, PRIMARY_CANDIDATE_PROFILE_ID]);
    const row = result.rows[0];
    assert(row, "The browser-created session was not persisted.");
    return {
        roleProfileId: row.role_profile_id,
        questionWordingStatus: row.question_wording_status,
        wording: row.question_wording_snapshot_json,
    };
}

async function waitForLiveQuestionProgress(pool: Pool, candidatePracticeSessionId: string) {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
        const result = await pool.query<{ progress_state_json: unknown }>(`
            select progress_state_json
            from public.candidate_practice_sessions
            where candidate_practice_session_id = $1
        `, [candidatePracticeSessionId]);
        const progress = result.rows[0]?.progress_state_json as { status?: string } | undefined;
        if (progress?.status === "live_question") return;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("Live-question progress was not persisted before recovery validation.");
}

async function assertSeedCandidateExists(pool: Pool) {
    const result = await pool.query(`
        select candidate_profile_id
        from public.candidate_profiles
        where candidate_profile_id = $1
    `, [PRIMARY_CANDIDATE_PROFILE_ID]);
    assert.equal(result.rowCount, 1, "Run npm run db:smoke-candidate-readiness before browser reconciliation.");
}

function readSessionId(url: string) {
    const match = new URL(url).pathname.match(/\/candidate\/session\/([0-9a-f-]+)$/i);
    assert(match?.[1], "The setup flow did not resolve to a candidate session URL.");
    return match[1];
}

function appendLog(log: string[], value: string) {
    log.push(value);
    if (log.length > 200) log.splice(0, log.length - 200);
}

function findAvailablePort(preferredPort: number): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.once("error", (error: NodeJS.ErrnoException) => {
            if (error.code === "EADDRINUSE" || error.code === "EACCES") {
                findAvailablePort(preferredPort + 1).then(resolve, reject);
                return;
            }
            reject(error);
        });
        server.once("listening", () => {
            const address = server.address();
            server.close(() => resolve(typeof address === "object" && address ? address.port : preferredPort));
        });
        server.listen(preferredPort, "127.0.0.1");
    });
}
