import { createHash } from "crypto";
import { getOptionalServerEnv } from "@/lib/server/config/server-env";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export type IdempotencyReservation =
    | { kind: "acquired" }
    | { kind: "replay"; statusCode: number; body: unknown }
    | { kind: "pending" }
    | { kind: "conflict" };

export type IdempotencyBackend = "supabase" | "postgres";

export type IdempotencyBeginInput = {
    scope: string;
    actorId: string;
    keyHash: string;
    requestHash: string;
    expiresAtIso: string;
};

export type IdempotencyCompleteInput = {
    scope: string;
    actorId: string;
    keyHash: string;
    statusCode: number;
    body: unknown;
};

export type IdempotencyReleaseInput = {
    scope: string;
    actorId: string;
    keyHash: string;
};

export type IdempotencyStore = {
    begin(params: IdempotencyBeginInput): Promise<IdempotencyReservation>;
    complete(params: IdempotencyCompleteInput): Promise<void>;
    release(params: IdempotencyReleaseInput): Promise<void>;
};

function sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);

    return `{${entries.join(",")}}`;
}

function keyHash(scope: string, key: string): string {
    return sha256(`${scope}:${key}`);
}

function requestHash(payload: unknown): string {
    return sha256(stableStringify(payload));
}

export function getIdempotencyBackend(): IdempotencyBackend {
    const rawBackend = getOptionalServerEnv("IDEMPOTENCY_BACKEND") ?? "supabase";
    const backend = rawBackend.toLowerCase();

    if (backend === "supabase" || backend === "postgres") {
        return backend;
    }

    throw new Error("[Idempotency] IDEMPOTENCY_BACKEND must be either 'supabase' or 'postgres'.");
}

async function createIdempotencyStore(): Promise<IdempotencyStore> {
    const backend = getIdempotencyBackend();

    if (backend === "postgres") {
        const { PostgresIdempotencyStore } = await import("@/lib/server/idempotency/postgres-idempotency-store");
        return new PostgresIdempotencyStore();
    }

    const { SupabaseIdempotencyStore } = await import("@/lib/server/idempotency/supabase-idempotency-store");
    return new SupabaseIdempotencyStore();
}

export async function beginIdempotentRequest(params: {
    scope: string;
    actorId: string;
    key: string;
    payload: unknown;
    ttlMs?: number;
}): Promise<IdempotencyReservation> {
    const store = await createIdempotencyStore();

    return store.begin({
        scope: params.scope,
        actorId: params.actorId,
        keyHash: keyHash(params.scope, params.key),
        requestHash: requestHash(params.payload),
        expiresAtIso: new Date(Date.now() + (params.ttlMs ?? DEFAULT_TTL_MS)).toISOString()
    });
}

export async function completeIdempotentRequest(params: {
    scope: string;
    actorId: string;
    key: string;
    statusCode: number;
    body: unknown;
}): Promise<void> {
    const store = await createIdempotencyStore();

    await store.complete({
        scope: params.scope,
        actorId: params.actorId,
        keyHash: keyHash(params.scope, params.key),
        statusCode: params.statusCode,
        body: params.body
    });
}

export async function releaseIdempotentRequest(params: {
    scope: string;
    actorId: string;
    key: string;
}): Promise<void> {
    const store = await createIdempotencyStore();

    await store.release({
        scope: params.scope,
        actorId: params.actorId,
        keyHash: keyHash(params.scope, params.key)
    });
}
