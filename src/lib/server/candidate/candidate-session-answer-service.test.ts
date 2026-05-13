import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    createSessionRepositoryMock,
    deleteAnalysisMock,
    findCandidatePracticeDraftBySessionIdMock,
    getSessionMock,
    updateMock,
    withCandidateMutationBoundaryMock,
} = vi.hoisted(() => ({
    createSessionRepositoryMock: vi.fn(),
    deleteAnalysisMock: vi.fn(),
    findCandidatePracticeDraftBySessionIdMock: vi.fn(),
    getSessionMock: vi.fn(),
    updateMock: vi.fn(),
    withCandidateMutationBoundaryMock: vi.fn(async ({ mutate }) => mutate()),
}));

vi.mock("./candidate-practice-draft-repository", () => ({
    findCandidatePracticeDraftBySessionId: findCandidatePracticeDraftBySessionIdMock,
}));

vi.mock("@/lib/server/infrastructure/session-repository", () => ({
    createSessionRepository: createSessionRepositoryMock,
}));

vi.mock("./candidate-mutation-boundary", () => ({
    withCandidateMutationBoundary: withCandidateMutationBoundaryMock,
}));

const baseSession = {
    id: "session-1",
    status: "IN_SESSION",
    role: "QA analyst",
    jobDescription: "Test regulated workflows.",
    currentQuestionIndex: 0,
    questions: [
        { id: "question-1", text: "Tell me about a release you improved.", category: "Behavioral", index: 0 },
    ],
    answers: {},
    initialsRequired: false,
} as const;

describe("candidate session answer service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findCandidatePracticeDraftBySessionIdMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        });
        getSessionMock.mockResolvedValue({ ...baseSession, answers: {} });
        updateMock.mockResolvedValue(undefined);
        deleteAnalysisMock.mockResolvedValue(undefined);
        createSessionRepositoryMock.mockResolvedValue({
            get: getSessionMock,
            update: updateMock,
            deleteAnalysis: deleteAnalysisMock,
        });
    });

    it("submits an answer for a candidate-owned session", async () => {
        const { submitCandidateOwnedAnswer } = await import("./candidate-session-answer-service");

        await expect(submitCandidateOwnedAnswer({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            questionId: "question-1",
            answerText: "I tightened the release checklist.",
        })).resolves.toMatchObject({
            ok: true,
            sessionId: "session-1",
            status: "AWAITING_EVALUATION",
            questionId: "question-1",
        });

        expect(deleteAnalysisMock).toHaveBeenCalledWith("session-1", "question-1");
        expect(withCandidateMutationBoundaryMock).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId: "profile-1",
            operation: "session_answer_submit",
            subjectId: "session-1:question-1",
        }));
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            id: "session-1",
            status: "AWAITING_EVALUATION",
            answers: {
                "question-1": expect.objectContaining({
                    questionId: "question-1",
                    transcript: "I tightened the release checklist.",
                    submittedAt: expect.any(Number),
                }),
            },
        }));
    });

    it("returns validation feedback for a blank answer", async () => {
        const { submitCandidateOwnedAnswer } = await import("./candidate-session-answer-service");

        await expect(submitCandidateOwnedAnswer({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            questionId: "question-1",
            answerText: "   ",
        })).resolves.toEqual({
            ok: false,
            error: "Answer text is required.",
        });

        expect(createSessionRepositoryMock).not.toHaveBeenCalled();
        expect(withCandidateMutationBoundaryMock).not.toHaveBeenCalled();
    });

    it("does not submit when the session is not owned by the current candidate", async () => {
        findCandidatePracticeDraftBySessionIdMock.mockResolvedValue(null);
        const { submitCandidateOwnedAnswer } = await import("./candidate-session-answer-service");

        await expect(submitCandidateOwnedAnswer({
            candidateProfileId: "profile-other",
            sessionId: "session-1",
            questionId: "question-1",
            answerText: "My answer",
        })).resolves.toEqual({
            ok: false,
            error: "Candidate session was not found.",
        });

        expect(createSessionRepositoryMock).not.toHaveBeenCalled();
    });

    it("retries a submitted question by clearing submission and analysis state", async () => {
        getSessionMock.mockResolvedValue({
            ...baseSession,
            status: "REVIEWING",
            answers: {
                "question-1": {
                    questionId: "question-1",
                    transcript: "Old answer",
                    submittedAt: 1770000000000,
                    analysis: { recommendation: "Use a clearer result." },
                },
            },
        });
        const { retryCandidateOwnedQuestion } = await import("./candidate-session-answer-service");

        await expect(retryCandidateOwnedQuestion({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            questionId: "question-1",
            retryContext: { trigger: "user" },
        })).resolves.toMatchObject({
            ok: true,
            sessionId: "session-1",
            status: "IN_SESSION",
            questionId: "question-1",
        });

        expect(deleteAnalysisMock).toHaveBeenCalledWith("session-1", "question-1");
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            status: "IN_SESSION",
            answers: {
                "question-1": {
                    questionId: "question-1",
                    transcript: "Old answer",
                    submittedAt: undefined,
                    analysis: undefined,
                    retryContext: { trigger: "user" },
                },
            },
        }));
        expect(withCandidateMutationBoundaryMock).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId: "profile-1",
            operation: "session_question_retry",
            subjectId: "session-1:question-1",
        }));
    });

    it("returns rate-limit feedback before loading the owned session", async () => {
        withCandidateMutationBoundaryMock.mockResolvedValue({
            ok: false,
            error: "Too many candidate updates. Please wait and try again.",
        });
        const { submitCandidateOwnedAnswer } = await import("./candidate-session-answer-service");

        await expect(submitCandidateOwnedAnswer({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            questionId: "question-1",
            answerText: "My answer",
        })).resolves.toEqual({
            ok: false,
            error: "Too many candidate updates. Please wait and try again.",
        });

        expect(findCandidatePracticeDraftBySessionIdMock).not.toHaveBeenCalled();
        expect(createSessionRepositoryMock).not.toHaveBeenCalled();
    });
});
