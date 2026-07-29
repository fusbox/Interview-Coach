import { createHash } from "node:crypto";
import { Pool } from "pg";

export type AppAuthQueryClient = {
    query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

type PoolState = {
    fingerprint: string;
    pool: Pool;
};

let poolState: PoolState | null = null;

export function createAppAuthQueryClient(databaseUrl: string): AppAuthQueryClient {
    return {
        query(sql, values = []) {
            return getPool(databaseUrl).query(sql, values);
        },
    };
}

export function createAppAuthQueryClientFromEnv(
    env: NodeJS.ProcessEnv = process.env,
): AppAuthQueryClient {
    const databaseUrl = env.DATABASE_URL?.trim();
    if (!databaseUrl) {
        throw new Error("App authentication requires DATABASE_URL.");
    }
    return createAppAuthQueryClient(databaseUrl);
}

function getPool(databaseUrl: string): Pool {
    const fingerprint = createHash("sha256").update(databaseUrl).digest("hex");
    if (poolState?.fingerprint === fingerprint) return poolState.pool;

    const previous = poolState;
    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: getSslConfig(databaseUrl),
        max: 2,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        statement_timeout: 15_000,
        query_timeout: 20_000,
        application_name: "interview-coach-app-auth",
    });
    poolState = { fingerprint, pool };
    if (previous) void previous.pool.end().catch(() => undefined);
    return pool;
}

function getSslConfig(databaseUrl: string) {
    try {
        const mode = new URL(databaseUrl).searchParams.get("sslmode")?.toLowerCase();
        if (mode === "disable") return false;
        if (mode) {
            return { rejectUnauthorized: mode === "verify-ca" || mode === "verify-full" };
        }
    } catch {
        return undefined;
    }
    return undefined;
}
