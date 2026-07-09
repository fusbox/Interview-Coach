import { describe, expect, it, vi } from "vitest";

import { handleCandidateSetupStartRequest, POST } from "./route";

describe("/candidate/setup/start route", () => {
    it("creates a provisional session transition from valid setup input", async () => {
        const response = await POST(new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
            method: "POST",
            body: JSON.stringify({
                targetRole: "Customer service representative",
                jobDescription: "Help customers resolve service questions.",
                resumeText: "",
                interviewStage: "first_interview",
                questionCount: 7,
            }),
        }));

        await expect(response.json()).resolves.toMatchObject({
            status: "session_created",
            sessionId: expect.any(String),
            nextRoute: expect.stringMatching(/^\/candidate\/session\/.+/),
            setupSnapshot: {
                targetRole: "Customer service representative",
                jobDescription: "Help customers resolve service questions.",
                resumeText: null,
                interviewStage: "first_interview",
                questionCount: 7,
                resumeCaptureMode: "none",
            },
            questionPlanSnapshot: {
                interviewStage: "first_interview",
                questionCount: 7,
                categoryCounts: {
                    screening: 2,
                    behavioral: 2,
                    culture_fit: 1,
                    case_scenario: 1,
                    technical_role_specific: 1,
                },
                slots: expect.arrayContaining([
                    expect.objectContaining({ id: "slot-1", category: "screening" }),
                    expect.objectContaining({ id: "slot-7", category: "behavioral" }),
                ]),
            },
            questionWordingSnapshot: {
                status: "questions_worded",
                questions: expect.arrayContaining([
                    expect.objectContaining({
                        slotId: "slot-1",
                        index: 0,
                        category: "screening",
                        questionText: "What interests you about this Customer service representative role?",
                    }),
                    expect.objectContaining({
                        slotId: "slot-2",
                        index: 1,
                        category: "behavioral",
                    }),
                ]),
            },
        });
        expect(response.status).toBe(201);
    });

    it("rejects invalid setup input", async () => {
        const response = await POST(new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
            method: "POST",
            body: JSON.stringify({
                targetRole: "",
                jobDescription: "",
                interviewStage: "first_interview",
                questionCount: 7,
            }),
        }));

        await expect(response.json()).resolves.toEqual({
            error: "Invalid setup request.",
        });
        expect(response.status).toBe(400);
    });

    it("persists the setup-created session when candidate identity dependencies resolve", async () => {
        const createSetupSession = vi.fn(async () => ({
            candidatePracticeSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }));

        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: {
                    Cookie: "ic_candidate_launch_session=launch-session-123",
                },
                body: JSON.stringify({
                    targetRole: "Customer service representative",
                    jobDescription: "Help customers resolve service questions.",
                    resumeText: "",
                    interviewStage: "first_interview",
                    questionCount: 7,
                }),
            }),
            now: new Date("2026-07-09T16:00:00.000Z"),
            createSessionId: () => "browser-bridge-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                candidateLaunchSessionId: "launch-session-123",
            })),
            practiceSessionRepository: {
                createSetupSession,
            },
        });

        await expect(response.json()).resolves.toMatchObject({
            status: "session_created",
            sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            nextRoute: "/candidate/session/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            setupSnapshot: {
                targetRole: "Customer service representative",
                createdAt: "2026-07-09T16:00:00.000Z",
            },
        });
        expect(response.status).toBe(201);
        expect(createSetupSession).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidateLaunchSessionId: "launch-session-123",
            roleProfileId: null,
            setupSnapshot: expect.objectContaining({
                targetRole: "Customer service representative",
            }),
            questionPlanSnapshot: expect.objectContaining({
                questionCount: 7,
            }),
            questionWordingSnapshot: expect.objectContaining({
                status: "questions_worded",
            }),
            progress: {
                status: "planned",
                currentQuestionIndex: 0,
            },
        }));
    });

    it("keeps the browser-bridge provisional response when candidate identity is unavailable", async () => {
        const createSetupSession = vi.fn();

        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                body: JSON.stringify({
                    targetRole: "Customer service representative",
                    jobDescription: "Help customers resolve service questions.",
                    interviewStage: "first_interview",
                    questionCount: 7,
                }),
            }),
            now: new Date("2026-07-09T16:00:00.000Z"),
            createSessionId: () => "browser-bridge-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => null),
            practiceSessionRepository: {
                createSetupSession,
            },
        });

        await expect(response.json()).resolves.toMatchObject({
            status: "session_created",
            sessionId: "browser-bridge-session-id",
            nextRoute: "/candidate/session/browser-bridge-session-id",
        });
        expect(response.status).toBe(201);
        expect(createSetupSession).not.toHaveBeenCalled();
    });

    it("fails closed when durable persistence is attempted but unavailable", async () => {
        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                body: JSON.stringify({
                    targetRole: "Customer service representative",
                    jobDescription: "Help customers resolve service questions.",
                    interviewStage: "first_interview",
                    questionCount: 7,
                }),
            }),
            now: new Date("2026-07-09T16:00:00.000Z"),
            createSessionId: () => "browser-bridge-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                createSetupSession: vi.fn(async () => null),
            },
        });

        await expect(response.json()).resolves.toEqual({
            error: "Candidate practice session could not be saved.",
        });
        expect(response.status).toBe(503);
    });
});
