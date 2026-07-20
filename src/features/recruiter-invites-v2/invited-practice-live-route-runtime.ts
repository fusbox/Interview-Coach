import { createInvitedPracticeAccessRepository } from "./invited-practice-access-repository";
import {
    INVITED_PRACTICE_ACCESS_COOKIE,
    hashInvitedPracticeBrowserSessionToken,
    isInvitedPracticeBearer,
} from "./invited-practice-access-session";
import {
    createInvitedPracticeAnswerHistoryRepository,
    createInvitedPracticeCandidateAnswerHistoryAdapter,
} from "./invited-practice-answer-history-repository";
import { createInvitedPracticeQueryClientFromEnv } from "./invited-practice-postgres-runtime";
import {
    createInvitedPracticeCandidateRouteRepositoryAdapter,
    createInvitedPracticeSessionRuntimeRepository,
} from "./invited-practice-session-runtime-repository";

export function createInvitedPracticeLiveRouteRuntime(expectedSessionId: string) {
    const queryClient = createInvitedPracticeQueryClientFromEnv();
    const accessRepository = createInvitedPracticeAccessRepository(queryClient);
    const sessionRepository = createInvitedPracticeSessionRuntimeRepository(queryClient);
    const answerHistoryRepository = createInvitedPracticeAnswerHistoryRepository(queryClient);

    const resolveInvitedIdentity = async (request: Request) => {
        const rawToken = readInvitedPracticeAccessCookie(request.headers.get("cookie"));
        if (!isInvitedPracticeBearer(rawToken)) return null;
        const context = await accessRepository.resolveBrowserSession(
            hashInvitedPracticeBrowserSessionToken(rawToken),
        );
        return context?.sessionId === expectedSessionId
            ? { recruiterInvitationRecipientId: context.recipientId }
            : null;
    };

    return {
        queryClient,
        sessionRepository,
        answerHistoryRepository,
        candidateRouteSessionRepository: createInvitedPracticeCandidateRouteRepositoryAdapter(sessionRepository),
        candidateRouteAnswerHistoryRepository: createInvitedPracticeCandidateAnswerHistoryAdapter(answerHistoryRepository),
        resolveInvitedIdentity,
        resolveCandidateRouteIdentity: async (request: Request) => {
            const identity = await resolveInvitedIdentity(request);
            if (!identity) return null;
            // Candidate-prefixed route handlers use this field as an opaque actor id.
            // The adapter maps it only to recruiter_invitation_recipient_id.
            return { candidateProfileId: identity.recruiterInvitationRecipientId };
        },
    };
}

export function readInvitedPracticeAccessCookie(cookieHeader: string | null) {
    if (!cookieHeader) return null;
    const cookie = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${INVITED_PRACTICE_ACCESS_COOKIE}=`));
    if (!cookie) return null;

    try {
        return decodeURIComponent(cookie.slice(INVITED_PRACTICE_ACCESS_COOKIE.length + 1));
    } catch {
        return null;
    }
}
