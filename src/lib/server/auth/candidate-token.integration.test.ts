import { randomUUID } from "crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashToken } from "@/lib/server/crypto";

const databaseUrl = process.env.POSTGRES_CANDIDATE_TOKEN_TEST_DATABASE_URL;
const runIntegration = databaseUrl ? describe : describe.skip;

runIntegration("Postgres candidate token integration", () => {
    let pool: Pool;
    let sessionId: string;
    let otherSessionId: string;

    beforeAll(async () => {
        if (!databaseUrl) {
            return;
        }

        process.env.DATABASE_URL = databaseUrl;
        process.env.CANDIDATE_TOKEN_BACKEND = "postgres";
        sessionId = randomUUID();
        otherSessionId = randomUUID();
        pool = new Pool({ connectionString: databaseUrl });

        await pool.query(
            `
                insert into public.sessions (
                    session_id,
                    status,
                    target_role
                )
                values
                    ($1, 'NOT_STARTED', 'Integration Candidate'),
                    ($2, 'NOT_STARTED', 'Integration Candidate Other')
            `,
            [sessionId, otherSessionId]
        );
    });

    afterAll(async () => {
        if (!pool) {
            return;
        }

        await pool.query("delete from public.sessions where session_id = any($1::uuid[])", [[sessionId, otherSessionId]]);
        await pool.end();

        const { closePostgresPoolForTests } = await import("../db/postgres");
        await closePostgresPoolForTests();
    });

    it("issues a hashed token and validates it for the matching session only", async () => {
        const { issueCandidateToken, requireCandidateToken } = await import("./candidate-token");

        const rawToken = await issueCandidateToken(sessionId);

        const stored = await pool.query(
            "select token_hash, session_id from public.candidate_tokens where session_id = $1",
            [sessionId]
        );
        expect(stored.rows).toHaveLength(1);
        expect(stored.rows[0]).toMatchObject({
            token_hash: hashToken(rawToken),
            session_id: sessionId
        });
        expect(stored.rows[0].token_hash).not.toBe(rawToken);

        const validRequest = new Request(`http://localhost/api/session/${sessionId}`, {
            headers: { "x-candidate-token": rawToken }
        });
        await expect(requireCandidateToken(validRequest, sessionId)).resolves.toEqual({ ok: true, status: 200 });

        const mismatchRequest = new Request(`http://localhost/api/session/${otherSessionId}`, {
            headers: { "x-candidate-token": rawToken }
        });
        await expect(requireCandidateToken(mismatchRequest, otherSessionId)).resolves.toEqual({
            ok: false,
            status: 403,
            error: "Token does not match session"
        });
    });

    it("rejects expired and revoked tokens", async () => {
        const { requireCandidateToken } = await import("./candidate-token");
        const expiredToken = `expired-${randomUUID()}`;
        const revokedToken = `revoked-${randomUUID()}`;

        await pool.query(
            `
                insert into public.candidate_tokens (
                    token_hash,
                    session_id,
                    expires_at
                )
                values ($1, $2, now() - interval '1 minute')
            `,
            [hashToken(expiredToken), sessionId]
        );
        await pool.query(
            `
                insert into public.candidate_tokens (
                    token_hash,
                    session_id,
                    revoked_at
                )
                values ($1, $2, now())
            `,
            [hashToken(revokedToken), sessionId]
        );

        for (const token of [expiredToken, revokedToken]) {
            const request = new Request(`http://localhost/api/session/${sessionId}`, {
                headers: { "x-candidate-token": token }
            });

            await expect(requireCandidateToken(request, sessionId)).resolves.toEqual({
                ok: false,
                status: 403,
                error: "Invalid candidate token"
            });
        }
    });
});
