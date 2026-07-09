import { describe, expect, it, vi } from "vitest";

import { handleCandidateAnswerDraftRequest } from "./route";

describe("/candidate/session/[sessionId]/answer-drafts route", () => {
    it("persists a typed answer draft when candidate identity resolves", async () => {
        const saveAnswerDraft = vi.fn(async () => ({
            "slot-1": {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text" as const,
                text: "I would ask a clarifying question first.",
                updatedAt: "2026-07-09T20:00:00.000Z",
            },
        }));

        const response = await handleCandidateAnswerDraftRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answer-drafts", {
                method: "PUT",
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text" as const,
                    text: "  I would ask a clarifying question first.  ",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-09T20:00:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                saveAnswerDraft,
            },
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            status: "answer_draft_saved",
            answerDrafts: {
                "slot-1": {
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                    updatedAt: "2026-07-09T20:00:00.000Z",
                },
            },
        });
        expect(saveAnswerDraft).toHaveBeenCalledWith({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidatePracticeSessionId: "session-1",
            draft: {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I would ask a clarifying question first.",
                updatedAt: "2026-07-09T20:00:00.000Z",
            },
        });
    });

    it("fails closed when candidate identity is unavailable", async () => {
        const response = await handleCandidateAnswerDraftRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answer-drafts", {
                method: "PUT",
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-09T20:00:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => null),
            practiceSessionRepository: {
                saveAnswerDraft: vi.fn(),
            },
        });

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: "Candidate session identity is required.",
        });
    });
});
