import { describe, expect, it, vi } from "vitest";

import {
    createCandidateDirectPracticeIntentFromResolvedItems,
    createCandidatePracticeIntentFromResolvedItems,
} from "./candidate-practice-intent-creation";
import type {
    CandidateResolvedFollowUpPracticeIntent,
} from "./candidate-follow-up-practice-intent";
import type { CandidateDirectPracticeIntentCreationRecord } from "./candidate-practice-intent-repository";

describe("candidate practice intent creation", () => {
    it("creates one durable ready intent from one or many resolved follow-up items", async () => {
        const createPracticeIntent = vi.fn(async () => ({
            candidatePracticeIntentId: "intent-1",
        }));

        await expect(createCandidatePracticeIntentFromResolvedItems({
            candidateProfileId: "candidate-1",
            source: "practice_builder",
            resolvedItems: [
                createResolvedItem("slot-1", 1),
                createResolvedItem("slot-2", 2),
            ],
            practiceIntentRepository: {
                createPracticeIntent,
            },
        })).resolves.toEqual({
            status: "candidate_practice_intent_created",
            candidatePracticeIntentId: "intent-1",
            redirectTo: "/candidate/practice/ready/intent-1",
            itemCount: 2,
        });

        expect(createPracticeIntent).toHaveBeenCalledWith({
            candidateProfileId: "candidate-1",
            source: "practice_builder",
            lifecycleState: "ready",
            roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            targetInterviewId: "material handler i",
            targetRole: "Material Handler I",
            setupContext: {
                targetRole: "Material Handler I",
                jobDescription: "Move materials safely.",
                interviewStage: "first_interview",
                questionCount: 3,
                resumeIncluded: false,
            },
            items: [
                expect.objectContaining({
                    source: expect.objectContaining({ questionKey: "slot-1" }),
                }),
                expect.objectContaining({
                    source: expect.objectContaining({ questionKey: "slot-2" }),
                }),
            ],
        });
    });

    it("does not create a durable practice intent when resolved items cannot form one target context", async () => {
        const createPracticeIntent = vi.fn();

        await expect(createCandidatePracticeIntentFromResolvedItems({
            candidateProfileId: "candidate-1",
            source: "practice_builder",
            resolvedItems: [
                createResolvedItem("slot-1", 1),
                createResolvedItem("slot-2", 2, { targetRole: "CSR", targetInterviewId: "csr" }),
            ],
            practiceIntentRepository: {
                createPracticeIntent,
            },
        })).resolves.toEqual({
            status: "candidate_practice_intent_not_created",
            reason: "invalid_intent_items",
        });

        expect(createPracticeIntent).not.toHaveBeenCalled();
    });

    it("does not merge same-title items from different prep contexts", async () => {
        const createPracticeIntent = vi.fn();

        await expect(createCandidatePracticeIntentFromResolvedItems({
            candidateProfileId: "candidate-1",
            source: "practice_builder",
            resolvedItems: [
                createResolvedItem("slot-1", 1),
                createResolvedItem("slot-2", 2, {
                    roleProfileId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                }),
            ],
            practiceIntentRepository: { createPracticeIntent },
        })).resolves.toEqual({
            status: "candidate_practice_intent_not_created",
            reason: "invalid_intent_items",
        });

        expect(createPracticeIntent).not.toHaveBeenCalled();
    });

    it("fails closed when durable practice intent persistence does not return an id", async () => {
        await expect(createCandidatePracticeIntentFromResolvedItems({
            candidateProfileId: "candidate-1",
            source: "coach_update_detail",
            resolvedItems: [createResolvedItem("slot-1", 1)],
            practiceIntentRepository: {
                createPracticeIntent: vi.fn(async () => null),
            },
        })).resolves.toEqual({
            status: "candidate_practice_intent_not_created",
            reason: "persistence_failed",
        });
    });

    it("replays one direct candidate action and conflicts changed content before another intent", async () => {
        const createDirectPracticeIntent = vi.fn(async (): Promise<CandidateDirectPracticeIntentCreationRecord> => ({
            outcome: "replayed",
            candidatePracticeIntentId: "intent-1",
            lifecycleState: "ready",
            consumedCandidatePracticeSessionId: null,
        }));

        await expect(createCandidateDirectPracticeIntentFromResolvedItems({
            candidateProfileId: "candidate-1",
            source: "coach_update_detail",
            resolvedItems: [createResolvedItem("slot-1", 1)],
            idempotencyKeyHash: "a".repeat(64),
            practiceIntentRepository: { createDirectPracticeIntent },
        })).resolves.toMatchObject({
            status: "candidate_practice_intent_created",
            candidatePracticeIntentId: "intent-1",
            redirectTo: "/candidate/practice/ready/intent-1",
            requestDisposition: "replayed",
        });
        expect(createDirectPracticeIntent).toHaveBeenCalledWith(expect.objectContaining({
            idempotencyKeyHash: "a".repeat(64),
            requestFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
            source: "coach_update_detail",
            items: [expect.objectContaining({ source: expect.objectContaining({ questionKey: "slot-1" }) })],
        }));

        createDirectPracticeIntent.mockResolvedValueOnce({
            outcome: "conflict",
            candidatePracticeIntentId: "intent-1",
            lifecycleState: "ready",
            consumedCandidatePracticeSessionId: null,
        });
        await expect(createCandidateDirectPracticeIntentFromResolvedItems({
            candidateProfileId: "candidate-1",
            source: "coach_update_detail",
            resolvedItems: [createResolvedItem("slot-2", 2)],
            idempotencyKeyHash: "a".repeat(64),
            practiceIntentRepository: { createDirectPracticeIntent },
        })).resolves.toEqual({
            status: "candidate_practice_intent_not_created",
            reason: "idempotency_conflict",
        });
    });
});

function createResolvedItem(
    questionKey: string,
    questionNumber: number,
    overrides: Partial<{
        targetRole: string;
        targetInterviewId: string;
        roleProfileId: string | null;
    }> = {},
): CandidateResolvedFollowUpPracticeIntent {
    const targetRole = overrides.targetRole ?? "Material Handler I";
    const targetInterviewId = overrides.targetInterviewId ?? "material handler i";
    const roleProfileId = overrides.roleProfileId === undefined
        ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        : overrides.roleProfileId;

    return {
        status: "candidate_follow_up_practice_intent_resolved",
        roleProfileId,
        kind: "practice_from_feedback",
        source: {
            kind: "coach_update_detail",
            candidatePracticeSessionId: "session-1",
            questionKey,
            targetInterviewId,
            targetRole,
            questionNumber,
            category: questionNumber === 1 ? "Screening" : "Behavioral",
            questionText: questionNumber === 1
                ? "What interests you about this Material Handler role?"
                : "Tell me about a time you handled an inventory issue.",
            evidenceStatus: "practiced_with_coaching",
        },
        setupContext: {
            targetRole,
            jobDescription: "Move materials safely.",
            interviewStage: "first_interview",
            questionCount: 3,
            resumeIncluded: false,
        },
        display: {
            label: "Practice from coach feedback",
            body: `I found the source coach read for ${targetRole}, question ${questionNumber}.`,
        },
    };
}
