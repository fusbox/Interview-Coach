import { describe, expect, it } from "vitest";

import { createSessionRuntimeFacts } from "./session-runtime-facts";
import {
    createSessionQuestionAudioPlaybackMemory,
    getSessionQuestionAudioPrefetchTargets,
} from "./session-question-audio-contract";

describe("session question audio contract", () => {
    it("prepares the current and next question without looking past the round", () => {
        const facts = createSessionRuntimeFacts({
            audience: "candidate_led",
            sessionId: "session-1",
            targetRole: "Material Handler",
            interviewStage: "first_interview",
            questionCount: 3,
            currentQuestionIndex: 1,
            questions: [
                createQuestion("slot-1", 0),
                createQuestion("slot-2", 1),
                createQuestion("slot-3", 2),
            ],
            completionBehavior: {
                kind: "candidate_dashboard",
                dashboardHref: "/candidate/dashboard",
            },
        });

        expect(getSessionQuestionAudioPrefetchTargets(facts)).toEqual([
            {
                sessionId: "session-1",
                questionKey: "slot-2",
                questionText: "Question 2",
            },
            {
                sessionId: "session-1",
                questionKey: "slot-3",
                questionText: "Question 3",
            },
        ]);
    });

    it("remembers playback per question within the current browser session", () => {
        const values = new Map<string, string>();
        const memory = createSessionQuestionAudioPlaybackMemory({
            getItem: (key) => values.get(key) ?? null,
            setItem: (key, value) => {
                values.set(key, value);
            },
        });
        const firstQuestion = {
            sessionId: "session-1",
            questionKey: "slot-1",
            questionText: "Question 1",
        };

        expect(memory.hasPlayed(firstQuestion)).toBe(false);
        memory.markPlayed(firstQuestion);
        expect(memory.hasPlayed(firstQuestion)).toBe(true);
        expect(memory.hasPlayed({ ...firstQuestion, questionKey: "slot-2" })).toBe(false);
        expect(memory.hasPlayed({ ...firstQuestion, sessionId: "session-2" })).toBe(false);
    });
});

function createQuestion(questionKey: string, questionIndex: number) {
    return {
        questionKey,
        questionIndex,
        category: "screening" as const,
        questionText: `Question ${questionIndex + 1}`,
    };
}
