import type { SessionRuntimeFactQuestion, SessionRuntimeFacts } from "./session-runtime-facts";

export const SESSION_QUESTION_AUDIO_PLAYED_STORAGE_PREFIX = "interview-coach:question-audio-played:v1";

export type SessionQuestionAudioTarget = {
    sessionId: string;
    questionKey: string;
    questionText: string;
};

export type SessionQuestionAudioLifecycle = {
    unlock: () => Promise<void> | void;
    prefetch: (target: SessionQuestionAudioTarget) => void;
    playOnce: (target: SessionQuestionAudioTarget) => Promise<void> | void;
    stop?: () => void;
};

export type SessionQuestionAudioPlaybackMemory = {
    hasPlayed: (target: SessionQuestionAudioTarget) => boolean;
    markPlayed: (target: SessionQuestionAudioTarget) => void;
};

export function toSessionQuestionAudioTarget({
    sessionId,
    question,
}: {
    sessionId: string;
    question: Pick<SessionRuntimeFactQuestion, "questionKey" | "questionText">;
}): SessionQuestionAudioTarget {
    return {
        sessionId,
        questionKey: question.questionKey,
        questionText: question.questionText,
    };
}

export function getSessionQuestionAudioPrefetchTargets(
    facts: Pick<SessionRuntimeFacts, "sessionId" | "currentQuestionIndex" | "questions">,
) {
    return facts.questions
        .slice(facts.currentQuestionIndex, facts.currentQuestionIndex + 2)
        .map((question) => toSessionQuestionAudioTarget({
            sessionId: facts.sessionId,
            question,
        }));
}

export function createSessionQuestionAudioPlaybackMemory(
    storage: Pick<Storage, "getItem" | "setItem">,
): SessionQuestionAudioPlaybackMemory {
    return {
        hasPlayed(target) {
            return storage.getItem(createPlayedStorageKey(target)) === "played";
        },
        markPlayed(target) {
            storage.setItem(createPlayedStorageKey(target), "played");
        },
    };
}

function createPlayedStorageKey(target: SessionQuestionAudioTarget) {
    return [
        SESSION_QUESTION_AUDIO_PLAYED_STORAGE_PREFIX,
        encodeURIComponent(target.sessionId),
        encodeURIComponent(target.questionKey),
    ].join(":");
}
