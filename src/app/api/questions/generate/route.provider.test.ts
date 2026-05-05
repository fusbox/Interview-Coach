import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const generateContentMock = vi.fn();
const incrementMetricMock = vi.fn();
const observeMetricMock = vi.fn();
const routeLoggerErrorMock = vi.fn();
const captureAiGenerationMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createClient: () => ({
        auth: {
            getUser: getUserMock
        }
    })
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock("@/lib/server/metrics", () => ({
    incrementMetric: incrementMetricMock,
    observeMetric: observeMetricMock,
    recordAuthDenial: vi.fn()
}));

vi.mock("@/lib/server/server-logger", () => ({
    createServerLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: routeLoggerErrorMock
    })
}));

vi.mock("@/lib/server/services/ai-config", () => ({
    ai: {
        models: {
            generateContent: generateContentMock
        }
    },
    AI_MODELS: {
        QUESTION_GEN: "mock-model"
    }
}));

vi.mock("@/lib/server/ai-quality/capture-ai-generation", () => ({
    captureAiGeneration: captureAiGenerationMock
}));

describe("POST /api/questions/generate provider validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        captureAiGenerationMock.mockResolvedValue("generation-1");
        getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    });

    it("captures successful provider generations with raw and parsed output", async () => {
        const providerText = JSON.stringify({
            behavioral: {
                "Conflict/Resolution": "How would you handle a disagreement with a teammate while keeping work moving?",
                "Adaptability": "Tell me about a time you adjusted quickly to a shift change.",
                "Initiative/Growth": "Describe a time you improved a process without being asked.",
                "Role-Specific Scenario": "What would you do if an order needed to be staged quickly but an item was missing?"
            },
            culture: {
                "Positive Emotion": "What helps you stay positive during a busy shift?",
                "Engagement": "What parts of warehouse work keep you focused?",
                "Relationships": "How do you build trust with teammates?",
                "Meaning": "What makes this kind of work meaningful to you?",
                "Accomplishment": "What work accomplishment are you proud of?"
            },
            technical: [
                { text: "What steps do you follow when picking and packing an order?" }
            ]
        });
        generateContentMock.mockResolvedValue({ text: providerText });

        const { POST } = await import("./route");
        const req = new Request("http://localhost/api/questions/generate", {
            method: "POST",
            body: JSON.stringify({
                role: "Warehouse Associate",
                jobDescription: "Pick, pack, and stage warehouse orders."
            })
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.technical[0].text).toBe("What steps do you follow when picking and packing an order?");
        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            appName: "recruiter_app",
            surface: "question_generation",
            status: "success",
            modelProvider: "gemini",
            modelName: "mock-model",
            rawOutput: providerText,
            parsedOutput: body,
            inputSnapshot: {
                role: "Warehouse Associate",
                hasJobDescription: true,
                hasResumeText: false
            },
            contextArtifacts: [
                expect.objectContaining({
                    type: "job_description",
                    content: "Pick, pack, and stage warehouse orders."
                })
            ],
            privacyFlags: [],
            redactionStatus: "redacted",
            retentionClass: "eval_redacted",
            createdBy: "user-1",
        }));
    });

    it("returns a sanitized internal error when Gemini returns schema-invalid JSON", async () => {
        const providerText = JSON.stringify({
            behavioral: { "Conflict/Resolution": "only one key" }
        });
        generateContentMock.mockResolvedValue({ text: providerText });

        const { POST } = await import("./route");
        const req = new Request("http://localhost/api/questions/generate", {
            method: "POST",
            body: JSON.stringify({ role: "QA Engineer" })
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body).toMatchObject({
            code: "INTERNAL_ERROR",
            message: "Internal server error",
            retryable: true
        });
        expect(incrementMetricMock).toHaveBeenCalledWith("ai_requests_total", {
            operation: "question_generation",
            outcome: "malformed_response"
        });
        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            appName: "recruiter_app",
            surface: "question_generation",
            status: "failed",
            modelProvider: "gemini",
            modelName: "mock-model",
            rawOutput: providerText,
            parsedOutput: null,
            inputSnapshot: {
                role: "QA Engineer",
                hasJobDescription: false,
                hasResumeText: false,
            },
            error: expect.objectContaining({
                name: "ProviderResponseError",
                provider: "gemini",
                operation: "generateQuestions",
                kind: "schema_validation",
            }),
            redactionStatus: "redacted",
            retentionClass: "eval_redacted",
        }));
        expect(routeLoggerErrorMock).toHaveBeenCalledWith(
            "Question generation failed",
            expect.objectContaining({
                provider: "gemini",
                operation: "generateQuestions",
                providerErrorKind: "schema_validation"
            })
        );
    });
});
