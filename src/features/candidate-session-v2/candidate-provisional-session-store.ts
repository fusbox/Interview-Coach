import type { CandidateSetupSessionCreationResult } from "@/features/candidate-setup-v2/candidate-setup-session-creation";
import {
    normalizeCandidateAnswerDrafts,
    type CandidateAnswerDrafts,
} from "./candidate-answer-lifecycle";
import type { CandidateQuestionWordingResult } from "./candidate-question-wording";

export const CANDIDATE_PROVISIONAL_SESSION_STORAGE_KEY = "interview-coach:candidate-provisional-sessions:v1";

export type CandidateProvisionalSessionProgress = {
    status: "planned" | "question_preview";
    currentQuestionIndex: number;
};

export type CandidateProvisionalSessionRecord = (CandidateSetupSessionCreationResult | (
    Omit<CandidateSetupSessionCreationResult, "questionWordingSnapshot"> & {
        questionWordingSnapshot?: CandidateQuestionWordingResult;
    }
)) & {
    progress?: CandidateProvisionalSessionProgress;
    answerDrafts?: CandidateAnswerDrafts;
};

type CandidateProvisionalSessionMap = Record<string, CandidateProvisionalSessionRecord>;

export function saveCandidateProvisionalSession(
    storage: Pick<Storage, "getItem" | "setItem">,
    session: CandidateProvisionalSessionRecord,
) {
    const sessions = readCandidateProvisionalSessionMap(storage);
    sessions[session.sessionId] = {
        ...session,
        progress: normalizeCandidateProvisionalSessionProgress(session.progress),
        answerDrafts: normalizeCandidateAnswerDrafts(session.answerDrafts),
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
    const currentQuestionIndex = progress?.currentQuestionIndex;

    return {
        status: progress?.status === "question_preview" ? "question_preview" : "planned",
        currentQuestionIndex: typeof currentQuestionIndex === "number"
            && Number.isInteger(currentQuestionIndex)
            && currentQuestionIndex >= 0
            ? currentQuestionIndex
            : 0,
    };
}
