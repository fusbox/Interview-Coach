import { describe, expect, it, vi } from "vitest";
import { PostgresIdempotencyStore } from "./postgres-idempotency-store";

describe("PostgresIdempotencyStore", () => {
    it("reacquires a key after its prior reservation expires", async () => {
        const query = vi
            .fn()
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({ rowCount: 1 });
        const store = new PostgresIdempotencyStore({ query } as never);

        await expect(store.begin({
            scope: "tips_generate",
            actorId: "session-1",
            keyHash: "key-hash",
            requestHash: "request-hash",
            expiresAtIso: "2026-05-20T00:00:00.000Z",
        })).resolves.toEqual({ kind: "acquired" });

        expect(query).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining("delete from public.api_idempotency_keys"),
            ["tips_generate", "session-1", "key-hash"]
        );
        expect(query).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining("insert into public.api_idempotency_keys"),
            [
                "tips_generate",
                "session-1",
                "key-hash",
                "request-hash",
                "2026-05-20T00:00:00.000Z",
            ]
        );
    });
});
