#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

const generatedTypeConfigPaths = ["next-env.d.ts", "tsconfig.json"];
const generatedTypeConfigSnapshots = await snapshotFiles(generatedTypeConfigPaths);
const outputDirectory = ".next-candidate-production-smoke";
const outputPath = path.resolve(outputDirectory);
const workspacePath = path.resolve(".");

if (!outputPath.startsWith(`${workspacePath}${path.sep}`)) {
    throw new Error(`Refusing to manage production smoke output outside the workspace: ${outputPath}`);
}

const port = await findAvailablePort(3100);
const baseURL = `http://127.0.0.1:${port}`;
const env = {
    ...process.env,
    NODE_ENV: "production",
    NEXT_DIST_DIR: outputDirectory,
    NEXT_PUBLIC_BASE_URL: baseURL,
    PLAYWRIGHT_BASE_URL: baseURL,
    PLAYWRIGHT_OUTPUT_DIR: path.join(outputDirectory, "playwright-results"),
    DATABASE_URL: "",
    CANDIDATE_HOST_LAUNCH_DEV_MODE: "false",
    CANDIDATE_HOST_LAUNCH_DEV_SECRET: "",
    CANDIDATE_HOST_LAUNCH_SECRET: "",
    GEMINI_API_KEY: "",
};

let server = null;
let exitCode = 1;

try {
    await rm(outputPath, { recursive: true, force: true });
    const build = runCommand(
        process.platform === "win32" ? "cmd.exe" : "npx",
        process.platform === "win32"
            ? ["/c", "npx", "next", "build", "--no-lint"]
            : ["next", "build", "--no-lint"],
        env,
    );
    if (build.status !== 0) {
        exitCode = build.status ?? 1;
    } else {
        server = spawn(
            process.platform === "win32" ? "cmd.exe" : "npx",
            process.platform === "win32"
                ? ["/c", "npx", "next", "start", "-H", "0.0.0.0", "-p", String(port)]
                : ["next", "start", "-H", "0.0.0.0", "-p", String(port)],
            {
                stdio: "inherit",
                env,
                detached: process.platform !== "win32",
            },
        );
        await waitForServer(baseURL, server);
        const browser = runCommand(
            process.platform === "win32" ? "cmd.exe" : "npx",
            process.platform === "win32"
                ? ["/c", "npx", "playwright", "test", "e2e/candidate/production-shell.spec.ts", "--config=playwright.candidate-production.config.ts"]
                : ["playwright", "test", "e2e/candidate/production-shell.spec.ts", "--config=playwright.candidate-production.config.ts"],
            env,
        );
        exitCode = browser.status ?? 1;
    }
} finally {
    if (server) {
        await stopServer(server);
    }
    await restoreFiles(generatedTypeConfigSnapshots);
    await rm(outputPath, { recursive: true, force: true });
}

process.exit(exitCode);

function runCommand(command, args, commandEnv) {
    const result = spawnSync(command, args, { stdio: "inherit", env: commandEnv });
    if (result.error) {
        throw result.error;
    }
    return result;
}

async function snapshotFiles(paths) {
    return Promise.all(paths.map(async (filePath) => ({
        path: filePath,
        contents: await readFile(filePath, "utf8"),
    })));
}

async function restoreFiles(snapshots) {
    await Promise.all(snapshots.map(({ path: filePath, contents }) => writeFile(filePath, contents, "utf8")));
}

async function waitForServer(url, childProcess) {
    const deadline = Date.now() + 60_000;
    let lastError;

    while (Date.now() < deadline) {
        if (childProcess.exitCode !== null) {
            throw new Error(`Next production server exited early with code ${childProcess.exitCode}.`);
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

    throw lastError ?? new Error(`Next production server did not become ready at ${url}.`);
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
            return;
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
            return;
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
