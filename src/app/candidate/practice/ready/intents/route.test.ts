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
                body: JSON.stringify({
                    source: "practice_builder",
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
            source: "practice_builder",
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
                body: JSON.stringify({
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
                body: JSON.stringify({
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
                body: JSON.stringify({
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
});
