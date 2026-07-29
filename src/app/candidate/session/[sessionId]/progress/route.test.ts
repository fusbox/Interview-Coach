import { describe, expect, it, vi } from "vitest";

import { handleCandidateSessionProgressRequest } from "./route-implementation";

describe("/candidate/session/[sessionId]/progress route", () => {
    it("persists question preview progress when candidate identity resolves", async () => {
        const saveProgress = vi.fn(async () => ({
            status: "question_preview" as const,
            currentQuestionIndex: 2,
        }));

        const response = await handleCandidateSessionProgressRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/progress", {
                method: "PUT",
                body: JSON.stringify({
                    status: "question_preview",
                    currentQuestionIndex: 2,
                }),
            }),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                saveProgress,
            },
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            status: "progress_saved",
            progress: {
                status: "question_preview",
                currentQuestionIndex: 2,
            },
        });
        expect(saveProgress).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            progress: {
                status: "question_preview",
                currentQuestionIndex: 2,
            },
        });
    });

    it("persists live question progress when candidate identity resolves", async () => {
        const saveProgress = vi.fn(async () => ({
            status: "live_question" as const,
            currentQuestionIndex: 0,
        }));

        const response = await handleCandidateSessionProgressRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/progress", {
                method: "PUT",
                body: JSON.stringify({
                    status: "live_question",
                    currentQuestionIndex: 0,
                }),
            }),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                saveProgress,
            },
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            status: "progress_saved",
            progress: {
                status: "live_question",
                currentQuestionIndex: 0,
            },
        });
        expect(saveProgress).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            progress: {
                status: "live_question",
                currentQuestionIndex: 0,
            },
        });
    });

    it("persists the explicit last-used voice mode with session progress", async () => {
        const saveProgress = vi.fn(async (input) => input.progress);

        const response = await handleCandidateSessionProgressRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/progress", {
                method: "PUT",
                body: JSON.stringify({
                    status: "live_question",
                    currentQuestionIndex: 1,
                    answerMode: "voice",
                }),
            }),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: { saveProgress },
        });

        expect(response.status).toBe(200);
        expect(saveProgress).toHaveBeenCalledWith(expect.objectContaining({
            progress: {
                status: "live_question",
                currentQuestionIndex: 1,
                answerMode: "voice",
            },
        }));
    });

    it("rejects unknown answer modes instead of persisting ambiguous UI state", async () => {
        const saveProgress = vi.fn();
        const response = await handleCandidateSessionProgressRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/progress", {
                method: "PUT",
                body: JSON.stringify({
                    status: "live_question",
                    currentQuestionIndex: 1,
                    answerMode: "photo",
                }),
            }),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: { saveProgress },
        });

        expect(response.status).toBe(400);
        expect(saveProgress).not.toHaveBeenCalled();
    });

    it("fails closed when candidate identity is unavailable", async () => {
        const response = await handleCandidateSessionProgressRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/progress", {
                method: "PUT",
                body: JSON.stringify({
                    status: "question_preview",
                    currentQuestionIndex: 2,
                }),
            }),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => null),
            practiceSessionRepository: {
                saveProgress: vi.fn(),
            },
        });

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: "Candidate session identity is required.",
        });
    });
});
