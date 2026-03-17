import { createAdminClient, createClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/server/crypto";
import { Logger } from "@/lib/logger";

const TOKEN_HEADER = "x-candidate-token";

interface CandidateTokenResult {
    ok: boolean;
    status: number;
    error?: string;
}

export async function requireCandidateToken(request: Request, sessionId: string): Promise<CandidateTokenResult> {
    const token = request.headers.get(TOKEN_HEADER);
    if (!token) {
        return { ok: false, status: 401, error: "Missing candidate token" };
    }

    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : createClient();
    const tokenHash = hashToken(token);

    const { data, error } = await supabase
        .from("candidate_tokens")
        .select("session_id")
        .eq("token_hash", tokenHash)
        .single();

    if (error || !data) {
        return { ok: false, status: 403, error: "Invalid candidate token" };
    }

    if (data.session_id !== sessionId) {
        return { ok: false, status: 403, error: "Token does not match session" };
    }

    return { ok: true, status: 200 };
}

export async function issueCandidateToken(sessionId: string): Promise<string> {
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : createClient();

    // Generate a random token (simple UUID or random string)
    const token = crypto.randomUUID();
    const tokenHash = hashToken(token);

    // Persist
    const { error } = await supabase
        .from("candidate_tokens")
        .insert({
            session_id: sessionId,
            token_hash: tokenHash,
            created_at: new Date().toISOString()
        });

    if (error) {
        Logger.error("Token Issuance Failed", error, "CandidateToken");
        throw new Error("Failed to issue token");
    }

    return token;
}
