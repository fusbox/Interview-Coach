#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { Pool } from "pg";

import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const generatedTypeConfigPaths = ["next-env.d.ts", "tsconfig.json"];
const generatedTypeConfigSnapshots = await snapshotFiles(generatedTypeConfigPaths);
const playwrightArgs = process.argv.slice(2);
// This suite performs deterministic fixture cleanup and must never target a shared DB.
const databaseUrl = getSmokeDatabaseUrl();
const port = await findAvailablePort(3000);
const baseURL = `http://127.0.0.1:${port}`;
const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    CANDIDATE_DATA_BACKEND: "postgres",
    CANDIDATE_AUTH_MODE: "password",
    CANDIDATE_HOST_LAUNCH_DEV_MODE: "true",
    CANDIDATE_HOST_LAUNCH_DEV_SECRET: "candidate-account-e2e-local-secret",
    CANDIDATE_ACCOUNT_EMAIL_PROVIDER: "fixture",
    CANDIDATE_ACCOUNT_PUBLIC_ORIGIN: baseURL,
    CANDIDATE_PASSWORD_RESET_TTL_SECONDS: "1800",
    CANDIDATE_QUESTION_WORDING_PROVIDER: "fixture",
    CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "fixture",
    CANDIDATE_COACH_UPDATE_PROVIDER: "fixture",
    GEMINI_API_KEY: "",
    SMTP_USERNAME: "",
    SMTP_PASSWORD: "",
    SMTP_HOST: "",
    SMTP_PORT: "",
    SMTP_FROM_EMAIL: "",
    NEXT_PUBLIC_BASE_URL: baseURL,
    PLAYWRIGHT_BASE_URL: baseURL,
    NEXT_DIST_DIR: ".next-candidate-account-e2e",
    E2E_TEST_MODE: "true",
    NEXT_PUBLIC_E2E_TEST_MODE: "true",
};

let server;

try {
    runRequiredCommand("npm", ["run", "db:smoke-candidate-app-account-lifecycle"], env);
    runRequiredCommand("npm", ["run", "db:seed-candidate-dev"], env);
    runRequiredCommand("npm", ["run", "db:seed-recruiter-dev"], env);
    await cleanBrowserFixture(databaseUrl);

    server = spawn(
        process.platform === "win32" ? "cmd.exe" : "npm",
        process.platform === "win32"
            ? ["/c", "npm", "run", "dev", "--", "-p", String(port)]
            : ["run", "dev", "--", "-p", String(port)],
        {
            stdio: "inherit",
            env,
            detached: process.platform !== "win32",
        },
    );

    await waitForServer(baseURL, server);
    const result = runPlaywright(env, playwrightArgs);
    process.exitCode = result.status ?? 1;
} finally {
    if (server) await stopServer(server);
    await cleanBrowserFixture(databaseUrl).catch(() => undefined);
    runRequiredCommand("npm", ["run", "db:seed-candidate-app-account-dev"], env);
    await restoreFiles(generatedTypeConfigSnapshots);
}

process.exit(process.exitCode ?? 0);

function runRequiredCommand(command, args, commandEnv) {
    const executable = process.platform === "win32" ? "cmd.exe" : command;
    const executableArgs = process.platform === "win32"
        ? ["/c", command, ...args]
        : args;
    const result = spawnSync(executable, executableArgs, {
        stdio: "inherit",
        env: commandEnv,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(" ")} failed with code ${result.status}.`);
    }
}

async function cleanBrowserFixture(connectionString) {
    const pool = new Pool({
        connectionString,
        max: 1,
        application_name: "candidate-account-browser-smoke-cleanup",
    });
    try {
        await pool.query("begin");
        const user = await pool.query(`
            select user_id
            from public.app_users
            where lower(email) = 'candidate-account-e2e@talentarbor.local'
            for update
        `);
        const userId = user.rows[0]?.user_id;
        if (userId) {
            await pool.query("set local session_replication_role = replica");
            await pool.query(
                "delete from public.candidate_consent_receipts where app_user_id = $1",
                [userId],
            );
            await pool.query("set local session_replication_role = origin");
            await pool.query("delete from public.auth_audit_events where user_id = $1", [userId]);
            await pool.query("delete from public.candidate_profiles where app_user_id = $1", [userId]);
            await pool.query("delete from public.app_users where user_id = $1", [userId]);
        }
        await pool.query("delete from public.rate_limit_buckets where bucket_key like 'candidate-account:%'");
        await pool.query("commit");
    } catch (error) {
        await pool.query("rollback").catch(() => undefined);
        throw error;
    } finally {
        await pool.end();
    }
}

async function snapshotFiles(paths) {
    return Promise.all(paths.map(async (path) => ({
        path,
        contents: await readFile(path, "utf8"),
    })));
}

async function restoreFiles(snapshots) {
    await Promise.all(snapshots.map(({ path, contents }) => writeFile(path, contents, "utf8")));
}

function runPlaywright(commandEnv, additionalArgs) {
    const command = process.platform === "win32" ? "cmd.exe" : "npx";
    const args = process.platform === "win32"
        ? [
            "/c",
            "npx",
            "playwright",
            "test",
            "e2e/candidate/account-access.spec.ts",
            "--config=playwright.candidate-account.config.ts",
            ...additionalArgs,
        ]
        : [
            "playwright",
            "test",
            "e2e/candidate/account-access.spec.ts",
            "--config=playwright.candidate-account.config.ts",
            ...additionalArgs,
        ];
    const result = spawnSync(command, args, { stdio: "inherit", env: commandEnv });
    if (result.error) throw result.error;
    return result;
}

async function waitForServer(url, childProcess) {
    const deadline = Date.now() + 45_000;
    let lastError;
    while (Date.now() < deadline) {
        if (childProcess.exitCode !== null) {
            throw new Error(`Next dev server exited early with code ${childProcess.exitCode}.`);
        }
        try {
            const response = await fetch(url);
            if (response.ok || response.status < 500) return;
        } catch (error) {
            lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw lastError ?? new Error(`Next dev server did not become ready at ${url}.`);
}

async function stopServer(childProcess) {
    const pid = childProcess.pid;
    if (!pid) return;
    if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
        return;
    }
    try {
        process.kill(-pid, "SIGTERM");
    } catch {
        try {
            process.kill(pid, "SIGTERM");
        } catch {
            return;
        }
    }
    await waitForExit(childProcess, 5000);
}

function waitForExit(childProcess, timeoutMs) {
    if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
        return Promise.resolve(true);
    }
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            childProcess.off("exit", onExit);
            resolve(false);
        }, timeoutMs);
        function onExit() {
            clearTimeout(timeout);
            resolve(true);
        }
        childProcess.once("exit", onExit);
    });
}

function findAvailablePort(preferredPort) {
    return new Promise((resolve, reject) => {
        const socket = createServer();
        socket.once("error", (error) => {
            if (error.code === "EADDRINUSE" || error.code === "EACCES") {
                findAvailablePort(preferredPort + 1).then(resolve, reject);
                return;
            }
            reject(error);
        });
        socket.once("listening", () => {
            const address = socket.address();
            socket.close(() => resolve(
                typeof address === "object" && address ? address.port : preferredPort,
            ));
        });
        socket.listen(preferredPort, "0.0.0.0");
    });
}
