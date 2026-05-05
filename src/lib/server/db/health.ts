import { getPostgresRuntimeConfig } from "@/lib/server/db/postgres-config";
import { queryPostgres } from "@/lib/server/db/postgres";

export type PostgresHealthStatus = "ok" | "failed";

export type PostgresHealthResult = {
    status: PostgresHealthStatus;
    checkedAt: string;
    latencyMs: number;
    configSource?: "database_url" | "individual_env";
    database?: string;
    error?: {
        code?: string;
        message: string;
    };
};

type DatabaseNameRow = {
    database_name: string;
};

function getErrorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null || !("code" in error)) {
        return undefined;
    }

    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
}

function getSafeErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return "Postgres health check failed.";
}

export async function checkPostgresHealth(): Promise<PostgresHealthResult> {
    const startedAt = Date.now();

    try {
        const config = getPostgresRuntimeConfig();
        const result = await queryPostgres<DatabaseNameRow>("select current_database() as database_name");

        return {
            status: "ok",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - startedAt,
            configSource: config.source,
            database: result.rows[0]?.database_name
        };
    } catch (error) {
        return {
            status: "failed",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - startedAt,
            error: {
                code: getErrorCode(error),
                message: getSafeErrorMessage(error)
            }
        };
    }
}
