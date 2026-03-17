import { createClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

const IDEMPOTENCY_SCOPE_TABLE = "api_idempotency_keys";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export type IdempotencyReservation =
    | { kind: "acquired" }
    | { kind: "replay"; statusCode: number; body: unknown }
    | { kind: "pending" }
    | { kind: "conflict" };

type IdempotencyRow = {
    scope: string;
    actor_id: string;
    key_hash: string;
    request_hash: string;
    status: "pending" | "completed";
    status_code: number | null;
    response_body: unknown;
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

export async function beginIdempotentRequest(params: {
    scope: string;
    actorId: string;
    key: string;
    payload: unknown;
    ttlMs?: number;
}): Promise<IdempotencyReservation> {
    const supabase = createClient();
    const hashedKey = keyHash(params.scope, params.key);
    const hashedPayload = requestHash(params.payload);
    const expiresAt = new Date(Date.now() + (params.ttlMs ?? DEFAULT_TTL_MS)).toISOString();

    const { error: insertError } = await supabase
        .from(IDEMPOTENCY_SCOPE_TABLE)
        .insert({
            scope: params.scope,
            actor_id: params.actorId,
            key_hash: hashedKey,
            request_hash: hashedPayload,
            status: "pending",
            expires_at: expiresAt
        });

    if (!insertError) {
        return { kind: "acquired" };
    }

    const { data: existing, error: selectError } = await supabase
        .from(IDEMPOTENCY_SCOPE_TABLE)
        .select("scope, actor_id, key_hash, request_hash, status, status_code, response_body")
        .eq("scope", params.scope)
        .eq("actor_id", params.actorId)
        .eq("key_hash", hashedKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle<IdempotencyRow>();

    if (selectError || !existing) {
        throw new Error("Failed to resolve idempotency state");
    }

    if (existing.request_hash !== hashedPayload) {
        return { kind: "conflict" };
    }

    if (existing.status === "completed" && existing.status_code !== null) {
        return {
            kind: "replay",
            statusCode: existing.status_code,
            body: existing.response_body
        };
    }

    return { kind: "pending" };
}

export async function completeIdempotentRequest(params: {
    scope: string;
    actorId: string;
    key: string;
    statusCode: number;
    body: unknown;
}): Promise<void> {
    const supabase = createClient();
    const hashedKey = keyHash(params.scope, params.key);

    const { error } = await supabase
        .from(IDEMPOTENCY_SCOPE_TABLE)
        .update({
            status: "completed",
            status_code: params.statusCode,
            response_body: params.body
        })
        .eq("scope", params.scope)
        .eq("actor_id", params.actorId)
        .eq("key_hash", hashedKey);

    if (error) {
        throw new Error("Failed to persist idempotent response");
    }
}

export async function releaseIdempotentRequest(params: {
    scope: string;
    actorId: string;
    key: string;
}): Promise<void> {
    const supabase = createClient();
    const hashedKey = keyHash(params.scope, params.key);

    await supabase
        .from(IDEMPOTENCY_SCOPE_TABLE)
        .delete()
        .eq("scope", params.scope)
        .eq("actor_id", params.actorId)
        .eq("key_hash", hashedKey)
        .eq("status", "pending");
}
