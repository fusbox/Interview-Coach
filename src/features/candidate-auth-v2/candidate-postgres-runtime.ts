import { createHash } from "crypto";
import { Pool } from "pg";

export type CandidatePostgresQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export function createCandidatePostgresQueryClient(databaseUrl: string): CandidatePostgresQueryClient {
    return {
        query(sql, values) {
            return getSharedPostgresPool(databaseUrl).query(sql, values);
        },
    };
}

type SharedPostgresPoolState = {
    fingerprint: string;
    pool: Pool;
};

let sharedPostgresPoolState: SharedPostgresPoolState | null = null;

function getSharedPostgresPool(databaseUrl: string) {
    const fingerprint = createHash("sha256").update(databaseUrl).digest("hex");
    if (sharedPostgresPoolState?.fingerprint === fingerprint) {
        return sharedPostgresPoolState.pool;
    }

    const previous = sharedPostgresPoolState;
    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: getRuntimeSslConfig(databaseUrl),
        max: 2,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        application_name: "interview-coach-candidate",
    });
    sharedPostgresPoolState = { fingerprint, pool };
    if (previous) {
        void previous.pool.end().catch(() => undefined);
    }
    return pool;
}

function getRuntimeSslConfig(databaseUrl: string) {
    const sslMode = readUrlSslMode(databaseUrl);
    if (sslMode === "disable") {
        return false;
    }
    if (sslMode) {
        return {
            rejectUnauthorized: sslMode === "verify-ca" || sslMode === "verify-full",
        };
    }
    return undefined;
}

function readUrlSslMode(databaseUrl: string) {
    try {
        return new URL(databaseUrl).searchParams.get("sslmode")?.toLowerCase() ?? null;
    } catch {
        return null;
    }
}
