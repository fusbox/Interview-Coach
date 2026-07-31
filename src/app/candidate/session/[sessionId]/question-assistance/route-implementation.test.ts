import { describe, expect, it, vi } from "vitest";

import type { CandidateQuestionAssistanceClaim } from "@/features/candidate-session-v2/candidate-question-assistance-repository";
import { createCandidateQuestionAssistanceRuntimeFromEnvironment } from "@/features/candidate-session-v2/candidate-question-assistance-runtime";

import { handleQuestionAssistanceRequest } from "./route-implementation";

const session = {
    setupSnapshot: {
        targetRole: "Quality Inspector",
        jobDescription: "Inspect finished work and document discrepancies.",
        resumeText: "Reviewed outbound orders and documented labeling errors.",
        interviewStage: "screening" as const,
        questionCount: 5,
        resumeCaptureMode: "pasted_text" as const,
        createdAt: "2026-07-29T12:00:00.000Z",
    },
    questionWordingSnapshot: {
        status: "questions_worded" as const,
        questions: [{
            slotId: "slot-1",
            index: 0,
            category: "behavioral" as const,
            questionText: "Tell me about a time you caught a quality issue.",
        }],
    },
};

function request(assistanceKind: "hints" | "strong_response" = "hints") {
    return new Request("http://localhost/candidate/session/session-1/question-assistance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionKey: "slot-1", assistanceKind }),
    });
}

describe("question assistance route implementation", () => {
    it("fails closed when the owned session identity is absent", async () => {
        const response = await handleQuestionAssistanceRequest({
            request: request(),
            sessionId: "session-1",
            resolveSessionIdentity: async () => null,
            sessionRepository: { findSetupSession: async () => session },
            assistanceRepository: createRepository({ kind: "claimed", claimToken: "claim-1", attemptCount: 1 }),
            assistanceRuntime: createCandidateQuestionAssistanceRuntimeFromEnvironment({ env: {} }),
        });

        expect(response.status).toBe(401);
    });

    it("distinguishes unavailable generation from failed identity", async () => {
        const response = await handleQuestionAssistanceRequest({
            request: request(),
            sessionId: "session-1",
            resolveSessionIdentity: async () => ({ ownerId: "owner-1" }),
            sessionRepository: { findSetupSession: async () => session },
            assistanceRepository: createRepository({ kind: "claimed", claimToken: "claim-1", attemptCount: 1 }),
            assistanceRuntime: null,
        });

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toMatchObject({ retryable: false });
    });

    it("generates and durably completes newly claimed hints", async () => {
        const repository = createRepository({
            kind: "claimed",
            claimToken: "claim-1",
            attemptCount: 1,
        });
        const runtime = createCandidateQuestionAssistanceRuntimeFromEnvironment({ env: {} });
        const generate = vi.spyOn(runtime, "generate");

        const response = await handleQuestionAssistanceRequest({
            request: request(),
            sessionId: "session-1",
            resolveSessionIdentity: async () => ({ ownerId: "owner-1" }),
            sessionRepository: { findSetupSession: async () => session },
            assistanceRepository: repository,
            assistanceRuntime: runtime,
            createClaimToken: () => "claim-1",
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            status: "ready",
            assistanceKind: "hints",
            output: { status: "candidate_question_hints_v1" },
        });
        expect(generate).toHaveBeenCalledWith(expect.objectContaining({
            questionKey: "slot-1",
            targetRole: "Quality Inspector",
        }));
        expect(repository.complete).toHaveBeenCalledWith(expect.objectContaining({
            practiceSessionId: "session-1",
            ownerId: "owner-1",
            questionKey: "slot-1",
            assistanceKind: "hints",
        }));
    });

    it("replays a durable artifact without calling the provider", async () => {
        const runtime = createCandidateQuestionAssistanceRuntimeFromEnvironment({ env: {} });
        const generate = vi.spyOn(runtime, "generate");
        const response = await handleQuestionAssistanceRequest({
            request: request("strong_response"),
            sessionId: "session-1",
            resolveSessionIdentity: async () => ({ ownerId: "owner-1" }),
            sessionRepository: { findSetupSession: async () => session },
            assistanceRepository: createRepository({
                kind: "replay",
                output: {
                    status: "candidate_strong_response_v1",
                    strongResponse:
                        "In a recent role, I checked the work against the approved requirements, documented the discrepancy, and raised it before the order moved forward.",
                    whyThisWorks:
                        "It gives a focused example and makes the candidate's own actions and judgment clear.",
                },
            }),
            assistanceRuntime: runtime,
        });

        expect(response.status).toBe(200);
        expect(generate).not.toHaveBeenCalled();
    });

    it("returns a non-retryable unavailable state after the generation cap", async () => {
        const runtime = createCandidateQuestionAssistanceRuntimeFromEnvironment({ env: {} });
        const generate = vi.spyOn(runtime, "generate");
        const response = await handleQuestionAssistanceRequest({
            request: request(),
            sessionId: "session-1",
            resolveSessionIdentity: async () => ({ ownerId: "owner-1" }),
            sessionRepository: { findSetupSession: async () => session },
            assistanceRepository: createRepository({ kind: "exhausted" }),
            assistanceRuntime: runtime,
        });

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toMatchObject({ retryable: false });
        expect(generate).not.toHaveBeenCalled();
    });
});

function createRepository(claim: CandidateQuestionAssistanceClaim) {
    return {
        claim: vi.fn(async () => claim),
        complete: vi.fn(async () => true),
        fail: vi.fn(async () => undefined),
    };
}
