#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { SMOKE_POSTGRES, getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

main();

function main() {
    ensureDockerAvailable();

    if (!containerExists()) {
        docker([
            "run",
            "--name", SMOKE_POSTGRES.containerName,
            "-e", `POSTGRES_PASSWORD=${SMOKE_POSTGRES.password}`,
            "-e", `POSTGRES_DB=${SMOKE_POSTGRES.database}`,
            "-p", `${SMOKE_POSTGRES.hostPort}:${SMOKE_POSTGRES.containerPort}`,
            "-d",
            SMOKE_POSTGRES.image,
        ]);
    } else if (!containerIsRunning()) {
        docker(["start", SMOKE_POSTGRES.containerName]);
    }

    waitForPostgres();

    console.log("Disposable Postgres smoke DB is ready.");
    console.log(`Container: ${SMOKE_POSTGRES.containerName}`);
    console.log(`Database URL: ${getSmokeDatabaseUrl()}`);
}

function ensureDockerAvailable() {
    docker(["version", "--format", "{{.Server.Version}}"], { stdio: "pipe" });
}

function containerExists() {
    const result = docker([
        "inspect",
        "-f", "{{.Name}}",
        SMOKE_POSTGRES.containerName,
    ], { allowFailure: true, stdio: "pipe" });

    return result.status === 0;
}

function containerIsRunning() {
    const result = docker([
        "inspect",
        "-f", "{{.State.Running}}",
        SMOKE_POSTGRES.containerName,
    ], { stdio: "pipe" });

    return result.stdout.trim() === "true";
}

function waitForPostgres() {
    const deadline = Date.now() + 30_000;
    let lastOutput = "";

    while (Date.now() < deadline) {
        const result = docker([
            "exec",
            SMOKE_POSTGRES.containerName,
            "pg_isready",
            "-U", SMOKE_POSTGRES.user,
            "-d", SMOKE_POSTGRES.database,
        ], { allowFailure: true, stdio: "pipe" });

        lastOutput = `${result.stdout}\n${result.stderr}`.trim();
        if (result.status === 0) {
            return;
        }

        sleep(1000);
    }

    throw new Error(`Postgres smoke container did not become ready. Last output: ${lastOutput}`);
}

function sleep(milliseconds) {
    const start = Date.now();
    while (Date.now() - start < milliseconds) {
        // Intentional tiny blocking wait for this setup-only script.
    }
}

function docker(args, options = {}) {
    const result = spawnSync("docker", args, {
        encoding: "utf8",
        stdio: options.stdio ?? "inherit",
    });

    if (result.error) {
        throw result.error;
    }

    if (!options.allowFailure && result.status !== 0) {
        throw new Error(`docker ${args.join(" ")} failed with exit code ${result.status}.`);
    }

    return {
        status: result.status ?? 0,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
    };
}
