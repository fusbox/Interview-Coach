import { describe, expect, it, vi } from "vitest";

import { handleCandidateAnswerSubmitRequest, resolveCandidateAnswerSubmitIdentityFromDevLaunchCookie } from "./route";

describe("/candidate/session/[sessionId]/answers route", () => {
    it("resolves explicit dev host-launch cookies for answer submit attempts", () => {
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");

        expect(resolveCandidateAnswerSubmitIdentityFromDevLaunchCookie(
            "ic_candidate_launch_session=dev-host-launch-100001",
        )).toEqual({
            candidateProfileId: "10000000-0000-4000-8000-000000000001",
        });
    });

    it("persists a typed answer submission after candidate-owned session verification", async () => {
        const findSetupSession = vi.fn(async () => ({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
        }));
        const saveAnswerSubmission = vi.fn(async () => ({
            "slot-1": {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text" as const,
                text: "I would ask a clarifying question first.",
                submittedAt: "2026-07-09T20:01:00.000Z",
                status: "pending_analysis" as const,
            },
        }));

        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-09T20:01:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession,
                saveAnswerSubmission,
            },
        });

        expect(response.status).toBe(202);
        await expect(response.json()).resolves.toEqual({
            status: "answer_submit_saved",
            answerSubmissions: {
                "slot-1": {
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                    submittedAt: "2026-07-09T20:01:00.000Z",
                    status: "pending_analysis",
                },
            },
            request: {
                status: "answer_submit_requested",
                requestedAt: "2026-07-09T20:01:00.000Z",
                draft: {
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                    updatedAt: "2026-07-09T20:01:00.000Z",
                },
            },
            next: "analysis_not_connected",
        });
        expect(findSetupSession).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
        });
        expect(saveAnswerSubmission).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            answerSubmission: {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I would ask a clarifying question first.",
                submittedAt: "2026-07-09T20:01:00.000Z",
                status: "pending_analysis",
            },
        });
    });

    it("rejects blank typed answer submissions as candidate-correctable input", async () => {
        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "   ",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-09T20:01:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(),
                saveAnswerSubmission: vi.fn(),
            },
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "Invalid answer submit request.",
        });
    });

    it("fails closed when candidate identity is unavailable", async () => {
        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-09T20:01:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => null),
            practiceSessionRepository: {
                findSetupSession: vi.fn(),
                saveAnswerSubmission: vi.fn(),
            },
        });

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: "Candidate session identity is required.",
        });
    });

    it("returns not found when the durable session is not owned by the candidate", async () => {
        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-09T20:01:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => null),
                saveAnswerSubmission: vi.fn(),
            },
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: "Candidate practice session was not found.",
        });
    });
});
