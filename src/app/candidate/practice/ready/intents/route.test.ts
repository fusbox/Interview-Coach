import { describe, expect, it, vi } from "vitest";

import {
    handleCandidatePracticeIntentCreateRequest,
    loadCandidatePracticeIntentSourceSessions,
} from "./route";

describe("/candidate/practice/ready/intents route", () => {
    it("loads every unique source session by candidate ownership instead of a recency window", async () => {
        const findSetupSession = vi.fn(async () => null);

        const sessions = await loadCandidatePracticeIntentSourceSessions({
            candidateProfileId: "candidate-1",
            pointers: [
                { intent: "coach-update-feedback-focus", fromSession: "old-session", questionKey: "slot-1" },
                { intent: "coach-update-missing-evidence", fromSession: "old-session", questionKey: "slot-2" },
                { intent: "coach-update-feedback-focus", fromSession: "new-session", questionKey: "slot-1" },
            ],
            findSetupSession,
        });

        expect(sessions).toEqual([]);
        expect(findSetupSession).toHaveBeenCalledTimes(2);
        expect(findSetupSession).toHaveBeenNthCalledWith(1, {
            candidateProfileId: "candidate-1",
            candidatePracticeSessionId: "old-session",
        });
        expect(findSetupSession).toHaveBeenNthCalledWith(2, {
            candidateProfileId: "candidate-1",
            candidatePracticeSessionId: "new-session",
        });
    });

    it("creates a durable practice intent from one or many stable source pointers", async () => {
        const createPracticeIntentFromPointers = vi.fn(async () => ({
            status: "candidate_practice_intent_created" as const,
            candidatePracticeIntentId: "intent-1",
            redirectTo: "/candidate/practice/ready/intent-1",
            itemCount: 2,
        }));

        const response = await handleCandidatePracticeIntentCreateRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/practice/ready/intents", {
                method: "POST",
                headers: { "Idempotency-Key": "direct-action-key-0001" },
                body: JSON.stringify({
                    source: "plan_aware_queue",
                    items: [
                        {
                            intent: "coach-update-feedback-focus",
                            fromSession: "session-1",
                            questionKey: "slot-1",
                        },
                        {
                            intent: "coach-update-missing-evidence",
                            fromSession: "session-1",
                            questionKey: "slot-2",
                        },
                    ],
                }),
            }),
            resolveCandidatePracticeIntentIdentity: vi.fn(async () => ({
                candidateProfileId: "candidate-1",
            })),
            createPracticeIntentFromPointers,
        });

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({
            status: "candidate_practice_intent_created",
            candidatePracticeIntentId: "intent-1",
            redirectTo: "/candidate/practice/ready/intent-1",
            itemCount: 2,
        });
        expect(createPracticeIntentFromPointers).toHaveBeenCalledWith({
            candidateProfileId: "candidate-1",
            source: "plan_aware_queue",
            idempotencyKeyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
            pointers: [
                {
                    intent: "coach-update-feedback-focus",
                    fromSession: "session-1",
                    questionKey: "slot-1",
                },
                {
                    intent: "coach-update-missing-evidence",
                    fromSession: "session-1",
                    questionKey: "slot-2",
                },
            ],
        });
    });

    it("rejects missing, empty, or unstable pointer payloads as candidate-correctable input", async () => {
        const response = await handleCandidatePracticeIntentCreateRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/practice/ready/intents", {
                method: "POST",
                headers: { "Idempotency-Key": "direct-action-key-0002" },
                body: JSON.stringify({
                    source: "coach_update_detail",
                    items: [
                        {
                            intent: "coach-update-feedback-focus",
                            fromSession: "session-1",
                            questionKey: "slot-1?answerText=leak",
                        },
                    ],
                }),
            }),
            resolveCandidatePracticeIntentIdentity: vi.fn(async () => ({
                candidateProfileId: "candidate-1",
            })),
            createPracticeIntentFromPointers: vi.fn(),
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "Invalid practice intent request.",
        });
    });

    it("fails closed when candidate identity cannot be resolved", async () => {
        const response = await handleCandidatePracticeIntentCreateRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/practice/ready/intents", {
                method: "POST",
                headers: { "Idempotency-Key": "direct-action-key-0003" },
                body: JSON.stringify({
                    source: "coach_update_detail",
                    items: [
                        {
                            intent: "coach-update-feedback-focus",
                            fromSession: "session-1",
                            questionKey: "slot-1",
                        },
                    ],
                }),
            }),
            resolveCandidatePracticeIntentIdentity: vi.fn(async () => null),
            createPracticeIntentFromPointers: vi.fn(),
        });

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: "Candidate identity could not be confirmed.",
        });
    });

    it("fails closed when the source pointers cannot create a durable ready intent", async () => {
        const response = await handleCandidatePracticeIntentCreateRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/practice/ready/intents", {
                method: "POST",
                headers: { "Idempotency-Key": "direct-action-key-0004" },
                body: JSON.stringify({
                    source: "coach_update_detail",
                    items: [
                        {
                            intent: "coach-update-feedback-focus",
                            fromSession: "session-1",
                            questionKey: "slot-1",
                        },
                    ],
                }),
            }),
            resolveCandidatePracticeIntentIdentity: vi.fn(async () => ({
                candidateProfileId: "candidate-1",
            })),
            createPracticeIntentFromPointers: vi.fn(async () => ({
                status: "candidate_practice_intent_not_created" as const,
                reason: "invalid_intent_items" as const,
            })),
        });

        expect(response.status).toBe(422);
        await expect(response.json()).resolves.toEqual({
            error: "Practice intent could not be created.",
            reason: "invalid_intent_items",
        });
    });

    it("returns an exact replay without creating another direct intent", async () => {
        const response = await handleCandidatePracticeIntentCreateRequest({
            request: createRequest("direct-action-key-replay", {
                source: "coach_update_detail",
                items: [{
                    intent: "coach-update-feedback-focus",
                    fromSession: "session-1",
                    questionKey: "slot-1",
                }],
            }),
            resolveCandidatePracticeIntentIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            createPracticeIntentFromPointers: vi.fn(async () => ({
                status: "candidate_practice_intent_created" as const,
                candidatePracticeIntentId: "intent-1",
                redirectTo: "/candidate/practice/ready/intent-1",
                itemCount: 1,
                requestDisposition: "replayed" as const,
            })),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            candidatePracticeIntentId: "intent-1",
            requestDisposition: "replayed",
        });
    });

    it("conflicts changed content under the same candidate action key", async () => {
        const response = await handleCandidatePracticeIntentCreateRequest({
            request: createRequest("direct-action-key-conflict", {
                source: "coach_update_detail",
                items: [{
                    intent: "coach-update-feedback-focus",
                    fromSession: "session-1",
                    questionKey: "slot-2",
                }],
            }),
            resolveCandidatePracticeIntentIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            createPracticeIntentFromPointers: vi.fn(async () => ({
                status: "candidate_practice_intent_not_created" as const,
                reason: "idempotency_conflict" as const,
            })),
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({ reason: "idempotency_conflict" });
    });

    it("keeps the same action key retryable after a persistence failure", async () => {
        const createPracticeIntentFromPointers = vi.fn()
            .mockRejectedValueOnce(new Error("connection lost"))
            .mockResolvedValueOnce({
                status: "candidate_practice_intent_created" as const,
                candidatePracticeIntentId: "intent-recovered",
                redirectTo: "/candidate/practice/ready/intent-recovered",
                itemCount: 1,
                requestDisposition: "created" as const,
            });
        const dependencies = {
            resolveCandidatePracticeIntentIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            createPracticeIntentFromPointers,
        };
        const payload = {
            source: "coach_update_detail",
            items: [{
                intent: "coach-update-feedback-focus",
                fromSession: "session-1",
                questionKey: "slot-1",
            }],
        };

        const failed = await handleCandidatePracticeIntentCreateRequest({
            request: createRequest("direct-action-key-retry", payload),
            ...dependencies,
        });
        const recovered = await handleCandidatePracticeIntentCreateRequest({
            request: createRequest("direct-action-key-retry", payload),
            ...dependencies,
        });

        expect(failed.status).toBe(503);
        expect(recovered.status).toBe(201);
        expect(createPracticeIntentFromPointers).toHaveBeenCalledTimes(2);
    });

    it("requires an explicit request key and direct-action source", async () => {
        const response = await handleCandidatePracticeIntentCreateRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/practice/ready/intents", {
                method: "POST",
                body: JSON.stringify({
                    source: "practice_builder",
                    items: [{
                        intent: "coach-update-feedback-focus",
                        fromSession: "session-1",
                        questionKey: "slot-1",
                    }],
                }),
            }),
            resolveCandidatePracticeIntentIdentity: vi.fn(),
            createPracticeIntentFromPointers: vi.fn(),
        });

        expect(response.status).toBe(400);
    });
});

function createRequest(idempotencyKey: string, payload: unknown) {
    return new Request("https://interviewcoach.talentarbor.com/candidate/practice/ready/intents", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
    });
}
