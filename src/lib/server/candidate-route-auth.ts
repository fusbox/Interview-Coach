import { forbiddenResponse, unauthorizedResponse } from "@/lib/server/api-errors";
import { requireCandidateToken } from "@/lib/server/auth/candidate-token";

export async function authorizeCandidateSessionRequest(
    request: Request,
    sessionId: string,
    correlationId: string
) {
    const auth = await requireCandidateToken(request, sessionId);
    if (auth.ok) {
        return null;
    }

    if (auth.status === 401) {
        return unauthorizedResponse(correlationId, auth.error);
    }

    return forbiddenResponse(correlationId, auth.error);
}
