import type { CandidateSetupSessionCreationResult } from "@/features/candidate-setup-v2/candidate-setup-session-creation";
import {
    normalizeCandidateAnswerDrafts,
    normalizeCandidateAnswerSubmissions,
    type CandidateAnswerDrafts,
    type CandidateAnswerSubmissions,
} from "./candidate-answer-lifecycle";
import {
    normalizeSessionRuntimeProgress,
    type SessionRuntimeProgress,
} from "@/features/interview-session-v2/session-runtime-contract";
import type { CandidateQuestionWordingResult } from "./candidate-question-wording";
import type { CandidateAnswerAnalysisProviderResult } from "./candidate-answer-analysis-adapter";
import type { CandidateFeedbackActionEvent } from "./candidate-feedback-interaction";
import {
    normalizeCandidateAnswerAnalysisRecoveries,
    type CandidateAnswerAnalysisRecoveries,
} from "./candidate-answer-analysis-recovery";

export const CANDIDATE_PROVISIONAL_SESSION_STORAGE_KEY = "interview-coach:candidate-provisional-sessions:v1";

export type CandidateProvisionalSessionProgress = SessionRuntimeProgress;

export type CandidateProvisionalSessionRecord = (CandidateSetupSessionCreationResult | (
    Omit<CandidateSetupSessionCreationResult, "questionWordingSnapshot"> & {
        questionWordingSnapshot?: CandidateQuestionWordingResult;
    }
)) & {
    roleProfileId?: string | null;
    progress?: CandidateProvisionalSessionProgress;
    answerDrafts?: CandidateAnswerDrafts;
    answerSubmissions?: CandidateAnswerSubmissions;
    answerAnalysisSnapshots?: CandidateAnswerAnalysisSnapshots;
    answerAnalysisRecoveries?: CandidateAnswerAnalysisRecoveries;
    feedbackActionEvents?: CandidateFeedbackActionEvents;
};

type CandidateProvisionalSessionMap = Record<string, CandidateProvisionalSessionRecord>;
export type CandidateAnswerAnalysisSnapshots = Record<string, CandidateAnswerAnalysisProviderResult>;
export type CandidateFeedbackActionEvents = Record<string, CandidateFeedbackActionEvent>;

export function saveCandidateProvisionalSession(
    storage: Pick<Storage, "getItem" | "setItem">,
    session: CandidateProvisionalSessionRecord,
) {
    const sessions = readCandidateProvisionalSessionMap(storage);
    sessions[session.sessionId] = {
        ...session,
        progress: normalizeCandidateProvisionalSessionProgress(session.progress),
        answerDrafts: normalizeCandidateAnswerDrafts(session.answerDrafts),
        answerSubmissions: normalizeCandidateAnswerSubmissions(session.answerSubmissions),
        answerAnalysisSnapshots: normalizeCandidateAnswerAnalysisSnapshots(session.answerAnalysisSnapshots),
        answerAnalysisRecoveries: normalizeCandidateAnswerAnalysisRecoveries(session.answerAnalysisRecoveries),
        feedbackActionEvents: normalizeCandidateFeedbackActionEvents(session.feedbackActionEvents),
    };
    storage.setItem(CANDIDATE_PROVISIONAL_SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

export function readCandidateProvisionalSession(
    storage: Pick<Storage, "getItem">,
    sessionId: string,
) {
    return readCandidateProvisionalSessionMap(storage)[sessionId] ?? null;
}

export function readCandidateProvisionalSessionProgress(
    storage: Pick<Storage, "getItem">,
    sessionId: string,
) {
    return readCandidateProvisionalSession(storage, sessionId)?.progress ?? null;
}

export function saveCandidateProvisionalSessionProgress(
    storage: Pick<Storage, "getItem" | "setItem">,
    sessionId: string,
    progress: CandidateProvisionalSessionProgress,
) {
    const sessions = readCandidateProvisionalSessionMap(storage);
    const session = sessions[sessionId];
    if (!session) {
        return null;
    }

    const nextSession = {
        ...session,
        progress: normalizeCandidateProvisionalSessionProgress(progress),
    };
    sessions[sessionId] = nextSession;
    storage.setItem(CANDIDATE_PROVISIONAL_SESSION_STORAGE_KEY, JSON.stringify(sessions));

    return nextSession;
}

export function saveCandidateProvisionalSessionAnswerDraft(
    storage: Pick<Storage, "getItem" | "setItem">,
    sessionId: string,
    draft: CandidateAnswerDrafts[string],
) {
    const sessions = readCandidateProvisionalSessionMap(storage);
    const session = sessions[sessionId];
    if (!session) {
        return null;
    }

    const nextSession = {
        ...session,
        answerDrafts: {
            ...session.answerDrafts,
            [draft.slotId]: draft,
        },
    };
    sessions[sessionId] = nextSession;
    storage.setItem(CANDIDATE_PROVISIONAL_SESSION_STORAGE_KEY, JSON.stringify(sessions));

    return nextSession;
}

export function saveCandidateProvisionalSessionFeedbackActionEvent(
    storage: Pick<Storage, "getItem" | "setItem">,
    sessionId: string,
    feedbackActionEvent: CandidateFeedbackActionEvent,
) {
    const sessions = readCandidateProvisionalSessionMap(storage);
    const session = sessions[sessionId];
    if (!session) {
        return null;
    }

    const nextSession = {
        ...session,
        feedbackActionEvents: {
            ...session.feedbackActionEvents,
            [feedbackActionEvent.answer.slotId]: feedbackActionEvent,
        },
    };
    sessions[sessionId] = nextSession;
    storage.setItem(CANDIDATE_PROVISIONAL_SESSION_STORAGE_KEY, JSON.stringify(sessions));

    return nextSession;
}

function readCandidateProvisionalSessionMap(storage: Pick<Storage, "getItem">): CandidateProvisionalSessionMap {
    const rawValue = storage.getItem(CANDIDATE_PROVISIONAL_SESSION_STORAGE_KEY);
    if (!rawValue) {
        return {};
    }

    try {
        const parsed = JSON.parse(rawValue);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }

        return Object.fromEntries(
            Object.entries(parsed as CandidateProvisionalSessionMap).map(([sessionId, session]) => [
                sessionId,
                {
                    ...session,
                    progress: normalizeCandidateProvisionalSessionProgress(session.progress),
                    answerDrafts: normalizeCandidateAnswerDrafts(session.answerDrafts),
                    answerSubmissions: normalizeCandidateAnswerSubmissions(session.answerSubmissions),
                    answerAnalysisSnapshots: normalizeCandidateAnswerAnalysisSnapshots(session.answerAnalysisSnapshots),
                    answerAnalysisRecoveries: normalizeCandidateAnswerAnalysisRecoveries(session.answerAnalysisRecoveries),
                    feedbackActionEvents: normalizeCandidateFeedbackActionEvents(session.feedbackActionEvents),
                },
            ]),
        );
    } catch {
        return {};
    }
}

function normalizeCandidateProvisionalSessionProgress(
    progress?: CandidateProvisionalSessionProgress,
): CandidateProvisionalSessionProgress {
    return normalizeSessionRuntimeProgress(progress);
}

function normalizeCandidateAnswerAnalysisSnapshots(value: unknown): CandidateAnswerAnalysisSnapshots {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as CandidateAnswerAnalysisSnapshots;
}

function normalizeCandidateFeedbackActionEvents(value: unknown): CandidateFeedbackActionEvents {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as CandidateFeedbackActionEvents;
}
