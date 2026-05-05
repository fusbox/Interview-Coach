import { createAdminClient } from "@/lib/supabase/server";
import type { CandidateTokenStore } from "@/lib/server/auth/candidate-token";

type CandidateTokenRow = {
    session_id: string;
};

export class SupabaseCandidateTokenStore implements CandidateTokenStore {
    async getSessionIdByTokenHash(tokenHash: string): Promise<string | null> {
        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from("candidate_tokens")
            .select("session_id")
            .eq("token_hash", tokenHash)
            .single<CandidateTokenRow>();

        if (error || !data) {
            return null;
        }

        return data.session_id;
    }

    async insertToken(params: {
        sessionId: string;
        tokenHash: string;
        createdAt: string;
    }): Promise<void> {
        const supabase = createAdminClient();
        const { error } = await supabase
            .from("candidate_tokens")
            .insert({
                session_id: params.sessionId,
                token_hash: params.tokenHash,
                created_at: params.createdAt
            });

        if (error) {
            throw error;
        }
    }
}
