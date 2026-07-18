import { describe, expect, it } from "vitest";

import {
    createCandidateDirectPracticeIntentRequestFingerprint,
    hashCandidateDirectPracticeIntentIdempotencyKey,
    normalizeCandidateDirectPracticeIntentIdempotencyKey,
} from "./candidate-direct-practice-intent-request";
import type { CreateCandidatePracticeIntentInput } from "./candidate-practice-intent-repository";

describe("candidate direct practice intent request identity", () => {
    it("normalizes stable action keys and stores only their digest", () => {
        expect(normalizeCandidateDirectPracticeIntentIdempotencyKey(" action-key-00000001 "))
            .toBe("action-key-00000001");
        expect(normalizeCandidateDirectPracticeIntentIdempotencyKey("short")).toBeNull();
        expect(normalizeCandidateDirectPracticeIntentIdempotencyKey("unsafe key with spaces")).toBeNull();
        expect(hashCandidateDirectPracticeIntentIdempotencyKey("action-key-00000001"))
            .toMatch(/^[a-f0-9]{64}$/);
    });

    it("fingerprints the exact canonical snapshot while preserving item order", () => {
        const input = createIntentInput();
        const reorderedObject = {
            ...input,
            setupContext: {
                resumeIncluded: false,
                questionCount: 2,
                interviewStage: "screening",
                jobDescription: "Inspect finished goods.",
                targetRole: "Quality Inspector",
            },
        } as CreateCandidatePracticeIntentInput;
        const reorderedItems = { ...input, items: [...input.items].reverse() };

        expect(createCandidateDirectPracticeIntentRequestFingerprint(reorderedObject))
            .toBe(createCandidateDirectPracticeIntentRequestFingerprint(input));
        expect(createCandidateDirectPracticeIntentRequestFingerprint(reorderedItems))
            .not.toBe(createCandidateDirectPracticeIntentRequestFingerprint(input));
    });
});

function createIntentInput(): CreateCandidatePracticeIntentInput {
    return {
        candidateProfileId: "candidate-1",
        source: "plan_aware_queue",
        lifecycleState: "ready",
        roleProfileId: "role-1",
        targetInterviewId: "quality inspector",
        targetRole: "Quality Inspector",
        setupContext: {
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished goods.",
            interviewStage: "screening",
            questionCount: 2,
            resumeIncluded: false,
        },
        items: [
            { kind: "practice_from_feedback", source: { questionKey: "slot-1" } } as never,
            { kind: "practice_from_feedback", source: { questionKey: "slot-2" } } as never,
        ],
    };
}
