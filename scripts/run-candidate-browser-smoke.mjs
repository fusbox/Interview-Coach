#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const baseURL = "http://127.0.0.1:3000";
const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || getSmokeDatabaseUrl(),
    CANDIDATE_DATA_BACKEND: "postgres",
    CANDIDATE_AUTH_MODE: "password",
    CANDIDATE_DEV_EMAIL: "candidate-dev-primary@talentarbor.local",
    CANDIDATE_DEV_ISSUER: "interview-coach-local",
    CANDIDATE_DEV_SUBJECT: "candidate-dev-primary@talentarbor.local",
    CANDIDATE_DEV_DISPLAY_NAME: "Dev Candidate Primary",
    GEMINI_API_KEY: "",
    NEXT_PUBLIC_BASE_URL: baseURL,
    E2E_TEST_MODE: "true",
    NEXT_PUBLIC_E2E_TEST_MODE: "true",
};

const server = spawn(
    process.platform === "win32" ? "cmd.exe" : "npm",
    process.platform === "win32" ? ["/c", "npm", "run", "dev"] : ["run", "dev"],
    {
        stdio: "inherit",
        env,
    },
);

try {
    await waitForServer(baseURL, server);
    const result = runPlaywright(env);
    process.exitCode = result.status ?? 1;
} finally {
    stopServer(server.pid);
    process.exit(process.exitCode ?? 0);
}

function runPlaywright(env) {
    const command = process.platform === "win32" ? "cmd.exe" : "npx";
    const args = process.platform === "win32"
        ? ["/c", "npx", "playwright", "test", "e2e/candidate/seeded-setup-summary.spec.ts", "--config=playwright.candidate-seeded.config.ts"]
        : ["playwright", "test", "e2e/candidate/seeded-setup-summary.spec.ts", "--config=playwright.candidate-seeded.config.ts"];

    const result = spawnSync(command, args, { stdio: "inherit", env });

    if (result.error) {
        throw result.error;
    }

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
            if (response.ok || response.status < 500) {
                return;
            }
        } catch (error) {
            lastError = error;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw lastError ?? new Error(`Next dev server did not become ready at ${url}.`);
}

function stopServer(pid) {
    if (!pid) {
        return;
    }

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
            // The process may already be gone.
        }
    }
}
