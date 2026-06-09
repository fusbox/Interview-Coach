import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    analyzeAnswerMock,
    createSessionRepositoryMock,
    deleteAnalysisMock,
    findCandidatePracticeDraftBySessionIdMock,
    getSessionMock,
    updateMock,
    withCandidateMutationBoundaryMock,
} = vi.hoisted(() => ({
    analyzeAnswerMock: vi.fn(),
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

vi.mock("@/lib/server/services/ai-service", () => ({
    AIService: {
        analyzeAnswer: analyzeAnswerMock,
    },
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
        analyzeAnswerMock.mockResolvedValue({
            ack: "You gave a useful starting point.",
            transcript: "I tightened the release checklist.",
            recommendation: "Add a clearer metric.",
            contentPulse: {
                dimension: "outcome_explicitness",
                headline: "Add the measurable result",
                body: "Tie the checklist to a release outcome.",
                quote: "release checklist",
            },
            meta: { tier: 1, modality: "text" },
        });
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

    it("persists voice modality for candidate-owned answer submissions", async () => {
        const { submitCandidateOwnedAnswer } = await import("./candidate-session-answer-service");

        await expect(submitCandidateOwnedAnswer({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            questionId: "question-1",
            answerText: "I talked through the checklist.",
            modality: "voice",
        })).resolves.toMatchObject({
            ok: true,
            sessionId: "session-1",
            status: "AWAITING_EVALUATION",
            questionId: "question-1",
        });

        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            answers: {
                "question-1": expect.objectContaining({
                    transcript: "I talked through the checklist.",
                    modality: "voice",
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

    it("generates candidate-owned answer coaching after a submitted answer", async () => {
        getSessionMock.mockResolvedValue({
            ...baseSession,
            status: "AWAITING_EVALUATION",
            answers: {
                "question-1": {
                    questionId: "question-1",
                    transcript: "I tightened the release checklist.",
                    submittedAt: 1770000000000,
                },
            },
        });
        const { analyzeCandidateOwnedAnswer } = await import("./candidate-session-answer-service");

        await expect(analyzeCandidateOwnedAnswer({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            questionId: "question-1",
        })).resolves.toMatchObject({
            ok: true,
            sessionId: "session-1",
            status: "REVIEWING",
            questionId: "question-1",
            analysis: {
                recommendation: "Add a clearer metric.",
            },
        });

        expect(withCandidateMutationBoundaryMock).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId: "profile-1",
            operation: "session_answer_analyze",
            subjectId: "session-1:question-1",
        }));
        expect(analyzeAnswerMock).toHaveBeenCalledWith(
            baseSession.questions[0],
            "I tightened the release checklist.",
            null,
            { title: "QA analyst", competencies: [] },
            undefined,
            undefined,
            { current: 1, total: 1 },
            expect.objectContaining({
                appName: "candidate_app",
                candidateId: "profile-1",
                sessionId: "session-1",
            }),
        );
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            status: "REVIEWING",
            answers: {
                "question-1": expect.objectContaining({
                    transcript: "I tightened the release checklist.",
                    analysis: expect.objectContaining({
                        recommendation: "Add a clearer metric.",
                    }),
                }),
            },
        }));
    });

    it("replays existing current-shape candidate answer coaching without calling the model again", async () => {
        getSessionMock.mockResolvedValue({
            ...baseSession,
            status: "REVIEWING",
            answers: {
                "question-1": {
                    questionId: "question-1",
                    transcript: "Old answer",
                    submittedAt: 1770000000000,
                    analysis: {
                        ack: "Already ready.",
                        recommendation: "Already analyzed.",
                        nextAction: {
                            label: "Continue",
                            actionType: "next_question",
                        },
                        contentPulse: {
                            dimension: "outcome_explicitness",
                            headline: "Show the result",
                            body: "Tie the answer to an outcome.",
                            quote: "Old answer",
                        },
                        meta: { tier: 1, modality: "text" },
                    },
                },
            },
        });
        const { analyzeCandidateOwnedAnswer } = await import("./candidate-session-answer-service");

        await expect(analyzeCandidateOwnedAnswer({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            questionId: "question-1",
        })).resolves.toMatchObject({
            ok: true,
            sessionId: "session-1",
            status: "REVIEWING",
            questionId: "question-1",
            analysis: {
                recommendation: "Already analyzed.",
            },
        });

        expect(analyzeAnswerMock).not.toHaveBeenCalled();
        expect(updateMock).not.toHaveBeenCalled();
    });

    it("regenerates candidate answer coaching when persisted analysis is legacy-shaped", async () => {
        getSessionMock.mockResolvedValue({
            ...baseSession,
            status: "REVIEWING",
            answers: {
                "question-1": {
                    questionId: "question-1",
                    transcript: "Old answer",
                    submittedAt: 1770000000000,
                    analysis: { recommendation: "Legacy coaching without pulse fields." },
                },
            },
        });
        const { analyzeCandidateOwnedAnswer } = await import("./candidate-session-answer-service");

        await expect(analyzeCandidateOwnedAnswer({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            questionId: "question-1",
        })).resolves.toMatchObject({
            ok: true,
            sessionId: "session-1",
            status: "REVIEWING",
            questionId: "question-1",
            analysis: {
                recommendation: "Add a clearer metric.",
            },
        });

        expect(analyzeAnswerMock).toHaveBeenCalledOnce();
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            answers: {
                "question-1": expect.objectContaining({
                    transcript: "I tightened the release checklist.",
                    analysis: expect.objectContaining({
                        contentPulse: expect.objectContaining({
                            headline: "Add the measurable result",
                        }),
                    }),
                }),
            },
        }));
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
