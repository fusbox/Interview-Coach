import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    createSessionRepositoryMock,
    findCandidatePracticeDraftBySessionIdMock,
    getSessionMock,
    resolveCandidateProfileFromIdentityMock,
    resolveLocalCandidateAuthHandoffMock,
} = vi.hoisted(() => ({
    createSessionRepositoryMock: vi.fn(),
    findCandidatePracticeDraftBySessionIdMock: vi.fn(),
    getSessionMock: vi.fn(),
    resolveCandidateProfileFromIdentityMock: vi.fn(),
    resolveLocalCandidateAuthHandoffMock: vi.fn(),
}));

vi.mock("@/lib/server/infrastructure/session-repository", () => ({
    createSessionRepository: createSessionRepositoryMock,
}));

vi.mock("./candidate-dev-auth-resolver", () => ({
    resolveLocalCandidateAuthHandoff: resolveLocalCandidateAuthHandoffMock,
}));

vi.mock("./candidate-profile-repository", () => ({
    resolveCandidateProfileFromIdentity: resolveCandidateProfileFromIdentityMock,
}));

vi.mock("./candidate-practice-draft-repository", () => ({
    findCandidatePracticeDraftBySessionId: findCandidatePracticeDraftBySessionIdMock,
}));

describe("candidate summary loader", () => {
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
            email: "candidate@example.com",
            displayName: "Candidate One",
        });
        findCandidatePracticeDraftBySessionIdMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        });
        createSessionRepositoryMock.mockResolvedValue({
            get: getSessionMock,
        });
    });

    it("returns null without candidate auth context", async () => {
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue(null);
        const { loadCandidateSummaryForCurrentCandidate } = await import("./candidate-summary-loader");

        await expect(loadCandidateSummaryForCurrentCandidate("session-1")).resolves.toBeNull();
        expect(findCandidatePracticeDraftBySessionIdMock).not.toHaveBeenCalled();
    });

    it("returns null when the session is not owned by the current candidate", async () => {
        findCandidatePracticeDraftBySessionIdMock.mockResolvedValue(null);
        const { loadCandidateSummaryForCurrentCandidate } = await import("./candidate-summary-loader");

        await expect(loadCandidateSummaryForCurrentCandidate("session-1")).resolves.toBeNull();
        expect(createSessionRepositoryMock).not.toHaveBeenCalled();
    });

    it("loads a completed candidate-owned summary model", async () => {
        getSessionMock.mockResolvedValue({
            id: "session-1",
            status: "COMPLETED",
            role: "QA Analyst",
            jobDescription: "Test regulated workflows.",
            currentQuestionIndex: 1,
            questions: [
                { id: "question-1", text: "Tell me about a release you improved.", category: "Behavioral", index: 0 },
                { id: "question-2", text: "How do you handle production risk?", category: "Technical", index: 1 },
            ],
            answers: {
                "question-1": {
                    questionId: "question-1",
                    transcript: "I improved release quality with a checklist.",
                    submittedAt: 1770000000000,
                    analysis: { recommendation: "Add a clearer metric." },
                },
            },
            summaryNarrative: "You were clear and structured. Add stronger impact metrics next.",
            initialsRequired: false,
        });
        const { loadCandidateSummaryForCurrentCandidate } = await import("./candidate-summary-loader");

        await expect(loadCandidateSummaryForCurrentCandidate("session-1")).resolves.toMatchObject({
            practiceDraftId: "draft-1",
            sessionId: "session-1",
            role: "QA Analyst",
            summaryNarrative: "You were clear and structured. Add stronger impact metrics next.",
            answeredCount: 1,
            questionCount: 2,
            answers: [
                {
                    questionText: "Tell me about a release you improved.",
                    transcript: "I improved release quality with a checklist.",
                    recommendation: "Add a clearer metric.",
                },
            ],
        });
    });
});
