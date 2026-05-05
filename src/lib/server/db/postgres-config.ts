export type PostgresConfigSource = "database_url" | "individual_env";

export type PostgresSslMode = "disable" | "allow" | "prefer" | "require" | "verify-ca" | "verify-full";

export type PostgresRuntimeConfig = {
    source: PostgresConfigSource;
    pool: {
        connectionString?: string;
        host?: string;
        port?: number;
        user?: string;
        password?: string;
        database?: string;
        ssl?: false | { rejectUnauthorized: boolean };
        max: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
        statement_timeout: number;
        query_timeout: number;
        application_name: string;
    };
};

type Env = Record<string, string | undefined>;

const DEFAULT_PORT = 5432;
const DEFAULT_POOL_MAX = 10;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 15_000;
const DEFAULT_QUERY_TIMEOUT_MS = 20_000;
const DEFAULT_APPLICATION_NAME = "interview-coach-recruiter";
const VALID_SSL_MODES = new Set<PostgresSslMode>([
    "disable",
    "allow",
    "prefer",
    "require",
    "verify-ca",
    "verify-full"
]);

function readOptionalEnv(env: Env, name: string): string | undefined {
    const rawValue = env[name];
    if (typeof rawValue !== "string") {
        return undefined;
    }

    const trimmedValue = rawValue.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function readRequiredEnv(env: Env, name: string, context: string): string {
    const value = readOptionalEnv(env, name);
    if (!value) {
        throw new Error(`[PostgresConfig] Missing required environment variable ${name} for ${context}.`);
    }

    return value;
}

function parsePositiveInt(value: string | undefined, fallback: number, name: string): number {
    if (!value) {
        return fallback;
    }

    const parsedValue = Number(value);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        throw new Error(`[PostgresConfig] ${name} must be a positive integer.`);
    }

    return parsedValue;
}

function parseBooleanEnv(value: string | undefined, name: string): boolean | undefined {
    if (!value) {
        return undefined;
    }

    const normalizedValue = value.toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalizedValue)) {
        return true;
    }

    if (["0", "false", "no", "off"].includes(normalizedValue)) {
        return false;
    }

    throw new Error(`[PostgresConfig] ${name} must be true or false.`);
}

function getUrlSslMode(connectionString: string): PostgresSslMode | undefined {
    try {
        const parsedUrl = new URL(connectionString);
        const rawSslMode = parsedUrl.searchParams.get("sslmode")?.trim().toLowerCase();
        if (!rawSslMode) {
            return undefined;
        }

        if (!VALID_SSL_MODES.has(rawSslMode as PostgresSslMode)) {
            throw new Error(`[PostgresConfig] DATABASE_URL sslmode is not supported: ${rawSslMode}.`);
        }

        return rawSslMode as PostgresSslMode;
    } catch (error) {
        if (error instanceof Error && error.message.startsWith("[PostgresConfig]")) {
            throw error;
        }

        return undefined;
    }
}

function resolveSslMode(env: Env, connectionString?: string): PostgresSslMode | undefined {
    const explicitMode = readOptionalEnv(env, "POSTGRES_SSL_MODE") ?? readOptionalEnv(env, "PGSSLMODE");
    if (explicitMode) {
        const normalizedMode = explicitMode.toLowerCase();
        if (!VALID_SSL_MODES.has(normalizedMode as PostgresSslMode)) {
            throw new Error(`[PostgresConfig] POSTGRES_SSL_MODE must be one of ${Array.from(VALID_SSL_MODES).join(", ")}.`);
        }

        return normalizedMode as PostgresSslMode;
    }

    return connectionString ? getUrlSslMode(connectionString) : undefined;
}

function resolveSslConfig(env: Env, connectionString?: string): false | { rejectUnauthorized: boolean } | undefined {
    const sslMode = resolveSslMode(env, connectionString);
    const rejectUnauthorized = parseBooleanEnv(
        readOptionalEnv(env, "POSTGRES_SSL_REJECT_UNAUTHORIZED"),
        "POSTGRES_SSL_REJECT_UNAUTHORIZED"
    );

    if (sslMode === "disable") {
        return false;
    }

    if (sslMode) {
        return {
            rejectUnauthorized: rejectUnauthorized ?? (sslMode === "verify-ca" || sslMode === "verify-full")
        };
    }

    if (rejectUnauthorized !== undefined) {
        return { rejectUnauthorized };
    }

    return undefined;
}

function getSharedPoolOptions(env: Env, applicationName: string) {
    return {
        max: parsePositiveInt(readOptionalEnv(env, "POSTGRES_POOL_MAX"), DEFAULT_POOL_MAX, "POSTGRES_POOL_MAX"),
        idleTimeoutMillis: parsePositiveInt(
            readOptionalEnv(env, "POSTGRES_IDLE_TIMEOUT_MS"),
            DEFAULT_IDLE_TIMEOUT_MS,
            "POSTGRES_IDLE_TIMEOUT_MS"
        ),
        connectionTimeoutMillis: parsePositiveInt(
            readOptionalEnv(env, "POSTGRES_CONNECTION_TIMEOUT_MS"),
            DEFAULT_CONNECTION_TIMEOUT_MS,
            "POSTGRES_CONNECTION_TIMEOUT_MS"
        ),
        statement_timeout: parsePositiveInt(
            readOptionalEnv(env, "POSTGRES_STATEMENT_TIMEOUT_MS"),
            DEFAULT_STATEMENT_TIMEOUT_MS,
            "POSTGRES_STATEMENT_TIMEOUT_MS"
        ),
        query_timeout: parsePositiveInt(
            readOptionalEnv(env, "POSTGRES_QUERY_TIMEOUT_MS"),
            DEFAULT_QUERY_TIMEOUT_MS,
            "POSTGRES_QUERY_TIMEOUT_MS"
        ),
        application_name: applicationName
    };
}

export function getPostgresRuntimeConfig(env: Env = process.env): PostgresRuntimeConfig {
    const applicationName = readOptionalEnv(env, "POSTGRES_APPLICATION_NAME") ?? DEFAULT_APPLICATION_NAME;
    const databaseUrl = readOptionalEnv(env, "DATABASE_URL");
    const sharedOptions = getSharedPoolOptions(env, applicationName);

    if (databaseUrl) {
        return {
            source: "database_url",
            pool: {
                connectionString: databaseUrl,
                ssl: resolveSslConfig(env, databaseUrl),
                ...sharedOptions
            }
        };
    }

    const context = "Postgres connection";

    return {
        source: "individual_env",
        pool: {
            host: readRequiredEnv(env, "POSTGRES_HOST", context),
            port: parsePositiveInt(readOptionalEnv(env, "POSTGRES_PORT"), DEFAULT_PORT, "POSTGRES_PORT"),
            user: readRequiredEnv(env, "POSTGRES_USER", context),
            password: readRequiredEnv(env, "POSTGRES_PASSWORD", context),
            database: readRequiredEnv(env, "POSTGRES_DB", context),
            ssl: resolveSslConfig(env),
            ...sharedOptions
        }
    };
}

export function assertPostgresEnvConfigured(env: Env = process.env): void {
    if (env.NODE_ENV !== "production") {
        return;
    }

    getPostgresRuntimeConfig(env);
}
