import { forbiddenResponse, unauthorizedResponse } from "@/lib/server/api-errors";
import { requireCandidateToken } from "@/lib/server/auth/candidate-token";
import {
    findCandidatePracticeDraftBySessionId,
    resolveCandidateProfileFromIdentity,
    resolveLocalCandidateAuthHandoff,
} from "@/lib/server/candidate";

export async function authorizeCandidateSessionRequest(
    request: Request,
    sessionId: string,
    correlationId: string
) {
    const auth = await requireCandidateToken(request, sessionId);
    if (auth.ok) {
        return null;
    }

    const candidateOwnsSession = await isCurrentCandidateSessionOwner(sessionId);
    if (candidateOwnsSession) {
        return null;
    }

    if (auth.status === 401) {
        return unauthorizedResponse(correlationId, auth.error);
    }

    return forbiddenResponse(correlationId, auth.error);
}

async function isCurrentCandidateSessionOwner(sessionId: string): Promise<boolean> {
    const handoff = await resolveLocalCandidateAuthHandoff();
    if (!handoff) {
        return false;
    }

    const profile = await resolveCandidateProfileFromIdentity(handoff);
    const draft = await findCandidatePracticeDraftBySessionId({
        candidateProfileId: profile.candidateProfileId,
        sessionId,
    });

    return Boolean(draft);
}
