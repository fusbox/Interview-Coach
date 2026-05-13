import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    analyzeCandidateOwnedAnswerMock,
    advanceCandidateOwnedSessionMock,
    pauseCandidateOwnedSessionMock,
    redirectMock,
    resolveCandidateProfileFromIdentityMock,
    resolveLocalCandidateAuthHandoffMock,
    resumeCandidateOwnedSessionMock,
    startCandidateOwnedSessionMock,
    retryCandidateOwnedQuestionMock,
    submitCandidateOwnedAnswerMock,
} = vi.hoisted(() => ({
    analyzeCandidateOwnedAnswerMock: vi.fn(),
    advanceCandidateOwnedSessionMock: vi.fn(),
    pauseCandidateOwnedSessionMock: vi.fn(),
    redirectMock: vi.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
    resolveCandidateProfileFromIdentityMock: vi.fn(),
    resolveLocalCandidateAuthHandoffMock: vi.fn(),
    resumeCandidateOwnedSessionMock: vi.fn(),
    startCandidateOwnedSessionMock: vi.fn(),
    retryCandidateOwnedQuestionMock: vi.fn(),
    submitCandidateOwnedAnswerMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    redirect: redirectMock,
}));

vi.mock("@/lib/server/candidate", () => ({
    resolveLocalCandidateAuthHandoff: resolveLocalCandidateAuthHandoffMock,
    resolveCandidateProfileFromIdentity: resolveCandidateProfileFromIdentityMock,
    analyzeCandidateOwnedAnswer: analyzeCandidateOwnedAnswerMock,
    startCandidateOwnedSession: startCandidateOwnedSessionMock,
    advanceCandidateOwnedSession: advanceCandidateOwnedSessionMock,
    pauseCandidateOwnedSession: pauseCandidateOwnedSessionMock,
    resumeCandidateOwnedSession: resumeCandidateOwnedSessionMock,
    retryCandidateOwnedQuestion: retryCandidateOwnedQuestionMock,
    submitCandidateOwnedAnswer: submitCandidateOwnedAnswerMock,
}));

describe("candidate session actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue({
            provider: "dev_mock",
            issuer: "interview-coach-local",
            subject: "candidate@example.com",
            email: "candidate@example.com",
            workspace: "local_dev",
        });
        resolveCandidateProfileFromIdentityMock.mockResolvedValue({
            candidateProfileId: "profile-1",
        });
    });

    it("starts the current candidate-owned session and redirects back to the route", async () => {
        startCandidateOwnedSessionMock.mockResolvedValue({
            ok: true,
            sessionId: "session-1",
            status: "IN_SESSION",
            currentQuestionIndex: 0,
            resumeTargetScreen: "session_in_progress",
        });
        const { startCandidateSessionAction } = await import("./actions");

        await expect(startCandidateSessionAction("session-1")).rejects.toThrow("NEXT_REDIRECT:/session/session-1");

        expect(startCandidateOwnedSessionMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        });
    });

    it("advances the current candidate-owned session and redirects back to the route", async () => {
        advanceCandidateOwnedSessionMock.mockResolvedValue({
            ok: true,
            sessionId: "session-1",
            status: "IN_SESSION",
            currentQuestionIndex: 1,
            resumeTargetScreen: "session_in_progress",
        });
        const { advanceCandidateSessionAction } = await import("./actions");

        await expect(advanceCandidateSessionAction("session-1", 1, "IN_SESSION")).rejects.toThrow("NEXT_REDIRECT:/session/session-1");

        expect(advanceCandidateOwnedSessionMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            currentQuestionIndex: 1,
            status: "IN_SESSION",
        });
    });

    it("pauses the current candidate-owned session and redirects back to the route", async () => {
        pauseCandidateOwnedSessionMock.mockResolvedValue({
            ok: true,
            sessionId: "session-1",
            status: "PAUSED",
            currentQuestionIndex: 1,
            resumeTargetScreen: "session_in_progress",
        });
        const { pauseCandidateSessionAction } = await import("./actions");

        await expect(pauseCandidateSessionAction("session-1")).rejects.toThrow("NEXT_REDIRECT:/session/session-1");

        expect(pauseCandidateOwnedSessionMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        });
    });

    it("resumes the current candidate-owned session and redirects back to the route", async () => {
        resumeCandidateOwnedSessionMock.mockResolvedValue({
            ok: true,
            sessionId: "session-1",
            status: "IN_SESSION",
            currentQuestionIndex: 1,
            resumeTargetScreen: "session_in_progress",
        });
        const { resumeCandidateSessionAction } = await import("./actions");

        await expect(resumeCandidateSessionAction("session-1")).rejects.toThrow("NEXT_REDIRECT:/session/session-1");

        expect(resumeCandidateOwnedSessionMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        });
    });

    it("submits a candidate answer from form data and redirects back to the route", async () => {
        submitCandidateOwnedAnswerMock.mockResolvedValue({
            ok: true,
            sessionId: "session-1",
            status: "AWAITING_EVALUATION",
            questionId: "question-1",
        });
        const formData = new FormData();
        formData.set("answerText", "I improved release quality with a clearer checklist.");
        const { submitCandidateAnswerAction } = await import("./actions");

        await expect(submitCandidateAnswerAction("session-1", "question-1", formData))
            .rejects
            .toThrow("NEXT_REDIRECT:/session/session-1");

        expect(submitCandidateOwnedAnswerMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            questionId: "question-1",
            answerText: "I improved release quality with a clearer checklist.",
        });
    });

    it("generates coaching for a candidate-owned answer and redirects back to the route", async () => {
        analyzeCandidateOwnedAnswerMock.mockResolvedValue({
            ok: true,
            sessionId: "session-1",
            status: "REVIEWING",
            questionId: "question-1",
            analysis: { recommendation: "Add a clearer metric." },
        });
        const { analyzeCandidateAnswerAction } = await import("./actions");

        await expect(analyzeCandidateAnswerAction("session-1", "question-1"))
            .rejects
            .toThrow("NEXT_REDIRECT:/session/session-1");

        expect(analyzeCandidateOwnedAnswerMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            questionId: "question-1",
        });
    });

    it("retries a candidate-owned question and redirects back to the route", async () => {
        retryCandidateOwnedQuestionMock.mockResolvedValue({
            ok: true,
            sessionId: "session-1",
            status: "IN_SESSION",
            questionId: "question-1",
        });
        const { retryCandidateQuestionAction } = await import("./actions");

        await expect(retryCandidateQuestionAction("session-1", "question-1"))
            .rejects
            .toThrow("NEXT_REDIRECT:/session/session-1");

        expect(retryCandidateOwnedQuestionMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            questionId: "question-1",
            retryContext: { trigger: "user" },
        });
    });

    it("returns ownership errors from progress mutations without redirecting", async () => {
        pauseCandidateOwnedSessionMock.mockResolvedValue({
            ok: false,
            error: "Candidate session was not found.",
        });
        const { pauseCandidateSessionAction } = await import("./actions");

        await expect(pauseCandidateSessionAction("session-other")).resolves.toEqual({
            ok: false,
            error: "Candidate session was not found.",
        });
        expect(redirectMock).not.toHaveBeenCalled();
    });

    it("returns an error when no candidate auth handoff exists", async () => {
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue(null);
        const { startCandidateSessionAction } = await import("./actions");

        await expect(startCandidateSessionAction("session-1")).resolves.toEqual({
            ok: false,
            error: "Candidate session is required.",
        });
        expect(startCandidateOwnedSessionMock).not.toHaveBeenCalled();
    });
});
