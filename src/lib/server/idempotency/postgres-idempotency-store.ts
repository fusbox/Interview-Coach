import { getPostgresPool } from "@/lib/server/db/postgres";
import type {
    IdempotencyBeginInput,
    IdempotencyCompleteInput,
    IdempotencyReleaseInput,
    IdempotencyReservation,
    IdempotencyStore
} from "@/lib/server/idempotency";
import type { Pool, QueryResultRow } from "pg";

type IdempotencyRow = QueryResultRow & {
    request_hash: string;
    status: "pending" | "completed";
    status_code: number | null;
    response_body: unknown;
};

export class PostgresIdempotencyStore implements IdempotencyStore {
    constructor(private readonly pool: Pool = getPostgresPool()) {}

    async begin(params: IdempotencyBeginInput): Promise<IdempotencyReservation> {
        await this.pool.query(
            `
                delete from public.api_idempotency_keys
                where scope = $1
                  and actor_id = $2
                  and key_hash = $3
                  and expires_at <= now()
            `,
            [
                params.scope,
                params.actorId,
                params.keyHash
            ]
        );

        const insertResult = await this.pool.query(
            `
                insert into public.api_idempotency_keys (
                    scope,
                    actor_id,
                    key_hash,
                    request_hash,
                    status,
                    expires_at
                )
                values ($1, $2, $3, $4, 'pending', $5)
                on conflict (scope, actor_id, key_hash) do nothing
                returning scope
            `,
            [
                params.scope,
                params.actorId,
                params.keyHash,
                params.requestHash,
                params.expiresAtIso
            ]
        );

        if ((insertResult.rowCount ?? 0) > 0) {
            return { kind: "acquired" };
        }

        const existingResult = await this.pool.query<IdempotencyRow>(
            `
                select
                    request_hash,
                    status,
                    status_code,
                    response_body
                from public.api_idempotency_keys
                where scope = $1
                  and actor_id = $2
                  and key_hash = $3
                  and expires_at > now()
                limit 1
            `,
            [params.scope, params.actorId, params.keyHash]
        );

        const existing = existingResult.rows[0];
        if (!existing) {
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
        const result = await this.pool.query(
            `
                update public.api_idempotency_keys
                set
                    status = 'completed',
                    status_code = $4,
                    response_body = $5::jsonb
                where scope = $1
                  and actor_id = $2
                  and key_hash = $3
            `,
            [
                params.scope,
                params.actorId,
                params.keyHash,
                params.statusCode,
                JSON.stringify(params.body)
            ]
        );

        if ((result.rowCount ?? 0) === 0) {
            throw new Error("Failed to persist idempotent response");
        }
    }

    async release(params: IdempotencyReleaseInput): Promise<void> {
        await this.pool.query(
            `
                delete from public.api_idempotency_keys
                where scope = $1
                  and actor_id = $2
                  and key_hash = $3
                  and status = 'pending'
            `,
            [params.scope, params.actorId, params.keyHash]
        );
    }
}
