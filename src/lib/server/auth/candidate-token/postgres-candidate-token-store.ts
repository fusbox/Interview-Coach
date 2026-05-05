import { getPostgresPool } from "@/lib/server/db/postgres";
import type { CandidateTokenStore } from "@/lib/server/auth/candidate-token";
import type { Pool, QueryResultRow } from "pg";

type CandidateTokenRow = QueryResultRow & {
    session_id: string;
};

export class PostgresCandidateTokenStore implements CandidateTokenStore {
    constructor(private readonly pool: Pool = getPostgresPool()) {}

    async getSessionIdByTokenHash(tokenHash: string): Promise<string | null> {
        const result = await this.pool.query<CandidateTokenRow>(
            `
                select session_id
                from public.candidate_tokens
                where token_hash = $1
                  and revoked_at is null
                  and (expires_at is null or expires_at > now())
                limit 1
            `,
            [tokenHash]
        );

        return result.rows[0]?.session_id ?? null;
    }

    async insertToken(params: {
        sessionId: string;
        tokenHash: string;
        createdAt: string;
    }): Promise<void> {
        await this.pool.query(
            `
                insert into public.candidate_tokens (
                    session_id,
                    token_hash,
                    created_at
                )
                values ($1, $2, $3)
            `,
            [
                params.sessionId,
                params.tokenHash,
                params.createdAt
            ]
        );
    }
}
