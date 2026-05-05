import { createAdminClient } from "@/lib/supabase/server";
import type {
    IdempotencyBeginInput,
    IdempotencyCompleteInput,
    IdempotencyReleaseInput,
    IdempotencyReservation,
    IdempotencyStore
} from "@/lib/server/idempotency";

const IDEMPOTENCY_SCOPE_TABLE = "api_idempotency_keys";

type IdempotencyRow = {
    scope: string;
    actor_id: string;
    key_hash: string;
    request_hash: string;
    status: "pending" | "completed";
    status_code: number | null;
    response_body: unknown;
};

export class SupabaseIdempotencyStore implements IdempotencyStore {
    async begin(params: IdempotencyBeginInput): Promise<IdempotencyReservation> {
        const supabase = createAdminClient();

        const { error: insertError } = await supabase
            .from(IDEMPOTENCY_SCOPE_TABLE)
            .insert({
                scope: params.scope,
                actor_id: params.actorId,
                key_hash: params.keyHash,
                request_hash: params.requestHash,
                status: "pending",
                expires_at: params.expiresAtIso
            });

        if (!insertError) {
            return { kind: "acquired" };
        }

        const { data: existing, error: selectError } = await supabase
            .from(IDEMPOTENCY_SCOPE_TABLE)
            .select("scope, actor_id, key_hash, request_hash, status, status_code, response_body")
            .eq("scope", params.scope)
            .eq("actor_id", params.actorId)
            .eq("key_hash", params.keyHash)
            .gt("expires_at", new Date().toISOString())
            .maybeSingle<IdempotencyRow>();

        if (selectError || !existing) {
            throw new Error("Failed to resolve idempotency state");
        }

        if (existing.request_hash !== params.requestHash) {
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

    async complete(params: IdempotencyCompleteInput): Promise<void> {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from(IDEMPOTENCY_SCOPE_TABLE)
            .update({
                status: "completed",
                status_code: params.statusCode,
                response_body: params.body
            })
            .eq("scope", params.scope)
            .eq("actor_id", params.actorId)
            .eq("key_hash", params.keyHash);

        if (error) {
            throw new Error("Failed to persist idempotent response");
        }
    }

    async release(params: IdempotencyReleaseInput): Promise<void> {
        const supabase = createAdminClient();

        await supabase
            .from(IDEMPOTENCY_SCOPE_TABLE)
            .delete()
            .eq("scope", params.scope)
            .eq("actor_id", params.actorId)
            .eq("key_hash", params.keyHash)
            .eq("status", "pending");
    }
}
