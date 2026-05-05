import { randomUUID } from "crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databaseUrl = process.env.POSTGRES_IDEMPOTENCY_TEST_DATABASE_URL;
const runIntegration = databaseUrl ? describe : describe.skip;

runIntegration("Postgres idempotency integration", () => {
    let pool: Pool;
    let actorId: string;

    beforeAll(async () => {
        if (!databaseUrl) {
            return;
        }

        process.env.IDEMPOTENCY_BACKEND = "postgres";
        process.env.DATABASE_URL = databaseUrl;
        actorId = randomUUID();
        pool = new Pool({ connectionString: databaseUrl });
    });

    afterAll(async () => {
        if (!pool) {
            return;
        }

        await pool.query("delete from public.api_idempotency_keys where actor_id = $1", [actorId]);
        await pool.end();
        const { closePostgresPoolForTests } = await import("./db/postgres");
        await closePostgresPoolForTests();
        vi.unstubAllEnvs();
    });

    it("reserves, blocks pending duplicates, completes, and replays matching requests", async () => {
        const { beginIdempotentRequest, completeIdempotentRequest } = await import("./idempotency");
        const scope = `integration:${randomUUID()}`;
        const key = "same-key";
        const payload = { answer: "one", nested: { order: ["a", "b"] } };

        await expect(beginIdempotentRequest({
            scope,
            actorId,
            key,
            payload
        })).resolves.toEqual({ kind: "acquired" });

        await expect(beginIdempotentRequest({
            scope,
            actorId,
            key,
            payload
        })).resolves.toEqual({ kind: "pending" });

        await completeIdempotentRequest({
            scope,
            actorId,
            key,
            statusCode: 207,
            body: { ok: true, status: "partial" }
        });

        await expect(beginIdempotentRequest({
            scope,
            actorId,
            key,
            payload
        })).resolves.toEqual({
            kind: "replay",
            statusCode: 207,
            body: { ok: true, status: "partial" }
        });
    });

    it("detects conflicting payloads and releases only pending reservations", async () => {
        const { beginIdempotentRequest, releaseIdempotentRequest } = await import("./idempotency");
        const scope = `integration:${randomUUID()}`;
        const key = "conflict-key";

        await expect(beginIdempotentRequest({
            scope,
            actorId,
            key,
            payload: { answer: "one" }
        })).resolves.toEqual({ kind: "acquired" });

        await expect(beginIdempotentRequest({
            scope,
            actorId,
            key,
            payload: { answer: "two" }
        })).resolves.toEqual({ kind: "conflict" });

        await releaseIdempotentRequest({
            scope,
            actorId,
            key
        });

        await expect(beginIdempotentRequest({
            scope,
            actorId,
            key,
            payload: { answer: "two" }
        })).resolves.toEqual({ kind: "acquired" });
    });
});
