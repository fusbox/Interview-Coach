export type LogLevel = "info" | "warn" | "error" | "debug";
export type ActorType = "anonymous" | "candidate" | "recruiter" | "service" | "system";

export type LogFields = {
    correlationId?: string;
    route?: string;
    actorType?: ActorType;
    actorId?: string;
    sessionId?: string;
    errorCode?: string;
    durationMs?: number;
    outcome?: string;
    method?: string;
    statusCode?: number;
    ip?: string;
    [key: string]: unknown;
};

export interface LogEntry extends LogFields {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: string;
    data?: unknown;
}

const RESERVED_FIELDS = new Set([
    "correlationId",
    "route",
    "actorType",
    "actorId",
    "sessionId",
    "errorCode",
    "durationMs",
    "outcome",
    "method",
    "statusCode",
    "ip"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeForLogging(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "bigint") return value.toString();

    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack
        };
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        if (depth >= 4) return "[TruncatedArray]";
        return value.map((entry) => sanitizeForLogging(entry, depth + 1, seen));
    }

    if (!isRecord(value)) {
        return String(value);
    }

    if (seen.has(value)) {
        return "[Circular]";
    }

    if (depth >= 4) {
        return "[TruncatedObject]";
    }

    seen.add(value);

    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
        result[key] = sanitizeForLogging(entryValue, depth + 1, seen);
    }

    seen.delete(value);
    return result;
}

function extractReservedFields(payload?: unknown) {
    if (!isRecord(payload)) {
        return { fields: {}, data: sanitizeForLogging(payload) };
    }

    const fields: LogFields = {};
    const remaining: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(payload)) {
        if (RESERVED_FIELDS.has(key)) {
            fields[key] = value;
            continue;
        }

        remaining[key] = value;
    }

    const data = Object.keys(remaining).length > 0 ? sanitizeForLogging(remaining) : undefined;
    return { fields, data };
}

class LoggerService {
    private format(level: LogLevel, message: string, payload?: unknown, context?: string): LogEntry {
        const { fields, data } = extractReservedFields(payload);

        return {
            level,
            message,
            timestamp: new Date().toISOString(),
            context,
            ...fields,
            ...(data === undefined ? {} : { data })
        };
    }

    private print(entry: LogEntry) {
        const serialized = JSON.stringify(entry);

        switch (entry.level) {
            case "info":
                console.info(serialized);
                break;
            case "warn":
                console.warn(serialized);
                break;
            case "error":
                console.error(serialized);
                break;
            case "debug":
                console.debug(serialized);
                break;
        }
    }

    info(message: string, payload?: unknown, context?: string) {
        this.print(this.format("info", message, payload, context));
    }

    warn(message: string, payload?: unknown, context?: string) {
        this.print(this.format("warn", message, payload, context));
    }

    error(message: string, payload?: unknown, context?: string) {
        this.print(this.format("error", message, payload, context));
    }

    debug(message: string, payload?: unknown, context?: string) {
        this.print(this.format("debug", message, payload, context));
    }
}

export const Logger = new LoggerService();
