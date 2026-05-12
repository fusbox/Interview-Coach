import type { InterviewSession } from "@/lib/domain/types";
import { createSessionRepository } from "@/lib/server/infrastructure/session-repository";

import { resolveLocalCandidateAuthHandoff } from "./candidate-dev-auth-resolver";
import { resolveCandidateProfileFromIdentity } from "./candidate-profile-repository";
import { findCandidatePracticeDraftBySessionId } from "./candidate-practice-draft-repository";

export type LoadedCandidateSession = {
    practiceDraftId: string;
    session: InterviewSession;
};

export async function loadCandidateSessionForCurrentCandidate(sessionId: string): Promise<LoadedCandidateSession | null> {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
        return null;
    }

    const handoff = await resolveLocalCandidateAuthHandoff();
    if (!handoff) {
        return null;
    }

    const profile = await resolveCandidateProfileFromIdentity(handoff);
    const draft = await findCandidatePracticeDraftBySessionId({
        candidateProfileId: profile.candidateProfileId,
        sessionId: normalizedSessionId,
    });

    if (!draft) {
        return null;
    }

    const repository = await createSessionRepository();
    const session = await repository.get(normalizedSessionId);
    if (!session) {
        return null;
    }

    await repository.markViewed(normalizedSessionId);

    return {
        practiceDraftId: draft.practiceDraftId,
        session,
    };
}
