import { createHash } from "node:crypto";
import { Pool } from "pg";

import type { InvitedPracticeAccessQueryClient } from "./invited-practice-access-repository";

let state: { fingerprint: string; pool: Pool } | null = null;

export function createInvitedPracticeQueryClientFromEnv(
    env: NodeJS.ProcessEnv = process.env,
): InvitedPracticeAccessQueryClient {
    const databaseUrl = env.DATABASE_URL?.trim();
    if (!databaseUrl) throw new Error("Invited practice requires DATABASE_URL.");
    const fingerprint = createHash("sha256").update(databaseUrl).digest("hex");
    if (!state || state.fingerprint !== fingerprint) {
        const previous = state;
        state = {
            fingerprint,
            pool: new Pool({
                connectionString: databaseUrl,
                ssl: getSslConfig(databaseUrl),
                max: 2,
                idleTimeoutMillis: 30_000,
                connectionTimeoutMillis: 5_000,
                statement_timeout: 15_000,
                query_timeout: 20_000,
                application_name: "interview-coach-invited-entry",
            }),
        };
        if (previous) void previous.pool.end().catch(() => undefined);
    }
    return { query: (sql, values) => state!.pool.query(sql, values) };
}

function getSslConfig(databaseUrl: string) {
    try {
        const mode = new URL(databaseUrl).searchParams.get("sslmode")?.toLowerCase();
        if (mode === "disable") return false;
        if (mode) return { rejectUnauthorized: mode === "verify-ca" || mode === "verify-full" };
    } catch {
        return undefined;
    }
    return undefined;
}
