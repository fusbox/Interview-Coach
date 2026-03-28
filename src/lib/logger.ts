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

function normalizeSensitiveKey(key: string) {
    return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function redactStringMatches(input: string, matcher: RegExp, replacement: string) {
    if (!matcher.test(input)) {
        return input;
    }

    matcher.lastIndex = 0;
    return input.replace(matcher, replacement);
}

function redactEmailValue(value: unknown): unknown {
    if (typeof value === "string") {
        return redactStringMatches(value, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]");
    }

    if (Array.isArray(value)) {
        return value.map(() => "[REDACTED_EMAIL]");
    }

    return "[REDACTED_EMAIL]";
}

function redactSensitiveValue(key: string, value: unknown): unknown {
    const normalizedKey = normalizeSensitiveKey(key);

    if (normalizedKey.includes("sessionid")) {
        return "[REDACTED_SESSION_ID]";
    }

    if (normalizedKey.includes("token")) {
        return "[REDACTED_TOKEN]";
    }

    if (
        normalizedKey.includes("apikey")
        || normalizedKey.includes("secret")
        || normalizedKey.includes("authorization")
        || normalizedKey.includes("cookie")
        || normalizedKey.includes("servicerolekey")
    ) {
        return "[REDACTED_SECRET]";
    }

    if (
        normalizedKey.includes("email")
        || normalizedKey === "to"
        || normalizedKey === "from"
        || normalizedKey === "cc"
        || normalizedKey === "bcc"
        || normalizedKey.includes("recipient")
    ) {
        return redactEmailValue(value);
    }

    if (normalizedKey === "invitelink" || normalizedKey === "practiceagainurl") {
        return "[REDACTED_URL]";
    }

    return value;
}

function sanitizeForLogging(value: unknown, depth = 0, seen = new WeakSet<object>(), key?: string): unknown {
    if (value === null || value === undefined) return value;

    const redactedValue = key ? redactSensitiveValue(key, value) : value;
    if (redactedValue !== value) {
        return redactedValue;
    }

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
        result[key] = sanitizeForLogging(entryValue, depth + 1, seen, key);
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
            fields[key] = sanitizeForLogging(value, 0, new WeakSet<object>(), key);
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
