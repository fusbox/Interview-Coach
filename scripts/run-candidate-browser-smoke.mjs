#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const generatedTypeConfigPaths = ["next-env.d.ts", "tsconfig.json"];
const generatedTypeConfigSnapshots = await snapshotFiles(generatedTypeConfigPaths);
const port = await findAvailablePort(3000);
const baseURL = `http://127.0.0.1:${port}`;
const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || getSmokeDatabaseUrl(),
    CANDIDATE_DATA_BACKEND: "postgres",
    CANDIDATE_AUTH_MODE: "password",
    CANDIDATE_DEV_EMAIL: "candidate-dev-primary@talentarbor.local",
    CANDIDATE_DEV_ISSUER: "interview-coach-local",
    CANDIDATE_DEV_SUBJECT: "candidate-dev-primary@talentarbor.local",
    CANDIDATE_DEV_DISPLAY_NAME: "Dev Candidate Primary",
    CANDIDATE_HOST_LAUNCH_DEV_MODE: "true",
    CANDIDATE_HOST_LAUNCH_DEV_SECRET: "candidate-e2e-local-secret",
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
    NEXT_DIST_DIR: ".next-candidate-e2e",
    E2E_TEST_MODE: "true",
    NEXT_PUBLIC_E2E_TEST_MODE: "true",
};

const server = spawn(
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

try {
    await waitForServer(baseURL, server);
    const result = runPlaywright(env);
    process.exitCode = result.status ?? 1;
} finally {
    await stopServer(server);
    await restoreFiles(generatedTypeConfigSnapshots);
    process.exit(process.exitCode ?? 0);
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

async function stopServer(childProcess) {
    const pid = childProcess.pid;
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

    if (await waitForExit(childProcess, 5000)) {
        return;
    }

    try {
        process.kill(-pid, "SIGKILL");
    } catch {
        try {
            process.kill(pid, "SIGKILL");
        } catch {
            // The process may already be gone.
        }
    }

    await waitForExit(childProcess, 2000);
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
        const server = createServer();

        server.once("error", (error) => {
            if (error.code === "EADDRINUSE" || error.code === "EACCES") {
                findAvailablePort(preferredPort + 1).then(resolve, reject);
                return;
            }

            reject(error);
        });

        server.once("listening", () => {
            const address = server.address();
            server.close(() => {
                resolve(typeof address === "object" && address ? address.port : preferredPort);
            });
        });

        server.listen(preferredPort, "0.0.0.0");
    });
}
