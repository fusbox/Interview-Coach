import { Logger } from "@/lib/logger";
import { getPostgresRuntimeConfig } from "@/lib/server/db/postgres-config";
import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from "pg";

type GlobalPostgresState = typeof globalThis & {
    __interviewCoachPostgresPool?: Pool;
};

const globalPostgresState = globalThis as GlobalPostgresState;

function createPostgresPool(): Pool {
    const config = getPostgresRuntimeConfig();
    const pool = new Pool(config.pool as PoolConfig);

    pool.on("error", (error) => {
        Logger.error("[Postgres] Idle client error", {
            error,
            configSource: config.source
        }, "Postgres");
    });

    return pool;
}

export function getPostgresPool(): Pool {
    if (!globalPostgresState.__interviewCoachPostgresPool) {
        globalPostgresState.__interviewCoachPostgresPool = createPostgresPool();
    }

    return globalPostgresState.__interviewCoachPostgresPool;
}

export async function queryPostgres<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
): Promise<QueryResult<T>> {
    return getPostgresPool().query<T>(text, values ? [...values] : undefined);
}

export async function closePostgresPoolForTests(): Promise<void> {
    if (!globalPostgresState.__interviewCoachPostgresPool) {
        return;
    }

    await globalPostgresState.__interviewCoachPostgresPool.end();
    globalPostgresState.__interviewCoachPostgresPool = undefined;
}
