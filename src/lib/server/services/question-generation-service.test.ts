import { beforeEach, describe, expect, it, vi } from "vitest";

const captureAiGenerationMock = vi.fn();

vi.mock("@/lib/server/services/ai-config", () => ({
    ai: null,
    AI_MODELS: {
        QUESTION_GEN: "mock-model",
    },
}));

vi.mock("@/lib/server/ai-quality/capture-ai-generation", () => ({
    captureAiGeneration: captureAiGenerationMock,
}));

describe("question generation service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        captureAiGenerationMock.mockResolvedValue("generation-1");
    });

    it("captures recruiter question generation through the shared service boundary", async () => {
        const { generateInterviewQuestionSet } = await import("./question-generation-service");

        const result = await generateInterviewQuestionSet(
            {
                role: "Warehouse Associate",
                jobDescription: "Pick, pack, and stage orders.",
                resume: "Forklift and inventory experience.",
            },
            {
                appName: "recruiter_app",
                actorType: "recruiter",
                actorId: "user-1",
                correlationId: "correlation-1",
                sourceRefs: [{ type: "route", route: "/api/questions/generate" }],
            },
        );

        expect(result.behavioral["Conflict/Resolution"]).toContain("Warehouse Associate");
        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            appName: "recruiter_app",
            surface: "question_generation",
            modelProvider: "mock",
            createdBy: "user-1",
            privacyFlags: ["contains_resume"],
            sourceRefs: [{ type: "route", route: "/api/questions/generate" }],
        }));
    });

    it("creates a candidate immutable question snapshot from the shared generated question set", async () => {
        const { generateCandidateQuestionSnapshot } = await import("./question-generation-service");

        const questions = await generateCandidateQuestionSnapshot(
            {
                role: "Reliability engineer",
                jobDescription: "Own deployment quality.",
                resume: "Reduced change failure rate.",
                interviewType: "technical",
                questionCount: 3,
            },
            {
                appName: "candidate_app",
                actorType: "candidate",
                actorId: "profile-1",
                correlationId: "correlation-candidate",
                sourceRefs: [{ type: "service", name: "candidate_session_generation" }],
            },
            {
                createQuestionId: (index) => `candidate-question-${index + 1}`,
            },
        );

        expect(questions).toHaveLength(3);
        expect(questions[0]).toMatchObject({
            id: "candidate-question-1",
            category: "Technical",
            index: 0,
        });
        expect(questions.map((question) => question.index)).toEqual([0, 1, 2]);
        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            appName: "candidate_app",
            candidateId: "profile-1",
            sourceRefs: [{ type: "service", name: "candidate_session_generation" }],
        }));
        expect(captureAiGenerationMock.mock.calls[0][0]).not.toHaveProperty("createdBy");
    });
});
