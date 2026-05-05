import { hashToken } from "@/lib/server/crypto";
import { Logger } from "@/lib/logger";
import { recordAuthDenial } from "@/lib/server/metrics";
import { assertProductionServerEnv, getOptionalServerEnv } from "@/lib/server/config/server-env";

const TOKEN_HEADER = "x-candidate-token";

export type CandidateTokenBackendName = "supabase" | "postgres";

interface CandidateTokenResult {
    ok: boolean;
    status: number;
    error?: string;
}

export interface CandidateTokenStore {
    getSessionIdByTokenHash(tokenHash: string): Promise<string | null>;
    insertToken(params: {
        sessionId: string;
        tokenHash: string;
        createdAt: string;
    }): Promise<void>;
}

export function getCandidateTokenBackendName(): CandidateTokenBackendName {
    const configured = getOptionalServerEnv("CANDIDATE_TOKEN_BACKEND")?.toLowerCase();
    if (!configured) {
        return "supabase";
    }

    if (configured === "supabase" || configured === "postgres") {
        return configured;
    }

    throw new Error(`Unsupported CANDIDATE_TOKEN_BACKEND value "${configured}". Expected "supabase" or "postgres".`);
}

async function createCandidateTokenStore(): Promise<CandidateTokenStore> {
    const backend = getCandidateTokenBackendName();

    if (backend === "postgres") {
        const { PostgresCandidateTokenStore } = await import("@/lib/server/auth/candidate-token/postgres-candidate-token-store");
        return new PostgresCandidateTokenStore();
    }

    assertProductionServerEnv(
        ["SUPABASE_SERVICE_ROLE_KEY"],
        "candidate token authentication"
    );
    const { SupabaseCandidateTokenStore } = await import("@/lib/server/auth/candidate-token/supabase-candidate-token-store");
    return new SupabaseCandidateTokenStore();
}

export async function requireCandidateToken(request: Request, sessionId: string): Promise<CandidateTokenResult> {
    const token = request.headers.get(TOKEN_HEADER);
    if (!token) {
        recordAuthDenial({
            actorType: "candidate",
            route: new URL(request.url).pathname,
            reason: "missing_candidate_token"
        });
        return { ok: false, status: 401, error: "Missing candidate token" };
    }

    const tokenHash = hashToken(token);
    const store = await createCandidateTokenStore();
    const storedSessionId = await store.getSessionIdByTokenHash(tokenHash);

    if (!storedSessionId) {
        recordAuthDenial({
            actorType: "candidate",
            route: new URL(request.url).pathname,
            reason: "invalid_candidate_token"
        });
        return { ok: false, status: 403, error: "Invalid candidate token" };
    }

    if (storedSessionId !== sessionId) {
        recordAuthDenial({
            actorType: "candidate",
            route: new URL(request.url).pathname,
            reason: "candidate_token_session_mismatch"
        });
        return { ok: false, status: 403, error: "Token does not match session" };
    }

    return { ok: true, status: 200 };
}

export async function issueCandidateToken(sessionId: string): Promise<string> {
    const store = await createCandidateTokenStore();

    const token = crypto.randomUUID();
    const tokenHash = hashToken(token);

    try {
        await store.insertToken({
            sessionId,
            tokenHash,
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        Logger.error("Token Issuance Failed", error, "CandidateToken");
        throw new Error("Failed to issue token");
    }

    return token;
}
