#!/usr/bin/env node
import { spawn } from "node:child_process";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || getSmokeDatabaseUrl(),
    CANDIDATE_DATA_BACKEND: process.env.CANDIDATE_DATA_BACKEND || "postgres",
    CANDIDATE_AUTH_MODE: process.env.CANDIDATE_AUTH_MODE || "dev",
    NEXT_PUBLIC_APP_URL: baseUrl,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || baseUrl,
};

const command = process.platform === "win32" ? "cmd.exe" : "npm";
const args = process.platform === "win32" ? ["/c", "npm", "run", "dev"] : ["run", "dev"];

const child = spawn(command, args, {
    stdio: "inherit",
    env,
});

child.on("exit", (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }

    process.exit(code ?? 0);
});

child.on("error", (error) => {
    throw error;
});
