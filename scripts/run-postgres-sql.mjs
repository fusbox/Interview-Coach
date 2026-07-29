#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printUsage();
        return;
    }

    if (!options.file) {
        throw new Error("Provide --file <path-to-sql-file>.");
    }

    const sqlPath = resolve(process.cwd(), options.file);
    const sql = await readFile(sqlPath, "utf8");
    const pool = new Pool(getPostgresPoolConfig(process.env, options));

    try {
        await pool.query(sql);
        console.log(`Applied SQL file: ${options.file}`);
    } finally {
        await pool.end();
    }
}

function parseArgs(args) {
    const options = {};

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--help" || arg === "-h") {
            options.help = true;
            continue;
        }

        if (arg === "--smoke-defaults") {
            options.smokeDefaults = true;
            continue;
        }

        if (arg === "--local-smoke-only") {
            options.localSmokeOnly = true;
            continue;
        }

        if (arg === "--file") {
            options.file = args[++index];
            if (!options.file) {
                throw new Error("Missing value for --file.");
            }
            continue;
        }

        if (arg.startsWith("--file=")) {
            options.file = arg.slice("--file=".length);
            continue;
        }

        throw new Error(`Unknown option "${arg}".`);
    }

    return options;
}

function getPostgresPoolConfig(env, options) {
    if (options.localSmokeOnly && env.NODE_ENV === "production") {
        throw new Error("--local-smoke-only is disabled when NODE_ENV=production.");
    }

    const databaseUrl = options.localSmokeOnly
        ? getSmokeDatabaseUrl()
        : readOptionalEnv(env, "DATABASE_MIGRATION_URL")
            ?? readOptionalEnv(env, "DATABASE_URL")
            ?? (options.smokeDefaults ? getSmokeDatabaseUrl() : undefined);
    const shared = {
        max: parsePositiveInt(readOptionalEnv(env, "POSTGRES_POOL_MAX"), 2, "POSTGRES_POOL_MAX"),
        idleTimeoutMillis: parsePositiveInt(readOptionalEnv(env, "POSTGRES_IDLE_TIMEOUT_MS"), 30_000, "POSTGRES_IDLE_TIMEOUT_MS"),
        connectionTimeoutMillis: parsePositiveInt(readOptionalEnv(env, "POSTGRES_CONNECTION_TIMEOUT_MS"), 5_000, "POSTGRES_CONNECTION_TIMEOUT_MS"),
        statement_timeout: parsePositiveInt(readOptionalEnv(env, "POSTGRES_STATEMENT_TIMEOUT_MS"), 15_000, "POSTGRES_STATEMENT_TIMEOUT_MS"),
        query_timeout: parsePositiveInt(readOptionalEnv(env, "POSTGRES_QUERY_TIMEOUT_MS"), 20_000, "POSTGRES_QUERY_TIMEOUT_MS"),
        application_name: readOptionalEnv(env, "POSTGRES_APPLICATION_NAME") ?? "interview-coach-sql-runner",
    };

    if (databaseUrl) {
        return {
            connectionString: databaseUrl,
            ssl: getSslConfig(env, databaseUrl),
            ...shared,
        };
    }

    return {
        host: readRequiredEnv(env, "POSTGRES_HOST"),
        port: parsePositiveInt(readOptionalEnv(env, "POSTGRES_PORT"), 5432, "POSTGRES_PORT"),
        user: readRequiredEnv(env, "POSTGRES_USER"),
        password: readRequiredEnv(env, "POSTGRES_PASSWORD"),
        database: readRequiredEnv(env, "POSTGRES_DB"),
        ssl: getSslConfig(env),
        ...shared,
    };
}

function getSslConfig(env, databaseUrl) {
    const mode = (readOptionalEnv(env, "POSTGRES_SSL_MODE") ?? readOptionalEnv(env, "PGSSLMODE") ?? getUrlSslMode(databaseUrl))?.toLowerCase();
    const rejectUnauthorized = parseBoolean(readOptionalEnv(env, "POSTGRES_SSL_REJECT_UNAUTHORIZED"));

    if (mode === "disable") {
        return false;
    }

    if (mode) {
        if (!["allow", "prefer", "require", "verify-ca", "verify-full"].includes(mode)) {
            throw new Error(`Unsupported POSTGRES_SSL_MODE "${mode}".`);
        }

        return {
            rejectUnauthorized: rejectUnauthorized ?? (mode === "verify-ca" || mode === "verify-full"),
        };
    }

    return rejectUnauthorized === undefined ? undefined : { rejectUnauthorized };
}

function getUrlSslMode(databaseUrl) {
    if (!databaseUrl) return undefined;
    try {
        return new URL(databaseUrl).searchParams.get("sslmode") ?? undefined;
    } catch {
        return undefined;
    }
}

function readOptionalEnv(env, name) {
    const value = env[name];
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function readRequiredEnv(env, name) {
    const value = readOptionalEnv(env, name);
    if (!value) {
        throw new Error(`Missing required environment variable ${name}. Provide DATABASE_URL or POSTGRES_* values, or pass --smoke-defaults.`);
    }

    return value;
}

function parsePositiveInt(value, fallback, name) {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${name} must be a positive integer.`);
    }

    return parsed;
}

function parseBoolean(value) {
    if (!value) return undefined;
    if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
    if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
    throw new Error("POSTGRES_SSL_REJECT_UNAUTHORIZED must be true or false.");
}

function printUsage() {
    console.log(`
Apply a SQL file to Postgres.

Usage:
  npm run db:apply-schema
  npm run db:smoke-schema
  node scripts/run-postgres-sql.mjs --file db/migrations/001_initial_schema.sql --smoke-defaults
  node scripts/run-postgres-sql.mjs --file db/seeds/003_recruiter_dev_seed.sql --local-smoke-only

Connection:
  Uses operator-only DATABASE_MIGRATION_URL when present, then DATABASE_URL or POSTGRES_* values.
  With --smoke-defaults, uses the local disposable smoke DB only when neither URL is present.
  --local-smoke-only always uses the disposable local DB and is disabled when NODE_ENV=production.
`);
}
