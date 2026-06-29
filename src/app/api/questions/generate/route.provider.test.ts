import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedRouteUserMock = vi.fn();
const generateContentMock = vi.fn();
const incrementMetricMock = vi.fn();
const observeMetricMock = vi.fn();
const routeLoggerErrorMock = vi.fn();
const captureAiGenerationMock = vi.fn();

vi.mock("@/lib/server/auth/current-user", () => ({
    getAuthenticatedRouteUser: getAuthenticatedRouteUserMock
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
        getAuthenticatedRouteUserMock.mockResolvedValue({ id: "user-1", email: "recruiter@example.com" });
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
            inputSnapshot: expect.objectContaining({
                role: "Warehouse Associate",
                hasJobDescription: true,
                hasResumeText: false
            }),
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

    it("repairs schema-valid provider output when the planned question mix needs more category slots", async () => {
        const providerText = JSON.stringify({
            behavioral: {
                "Conflict/Resolution": "Tell me about a time you calmed down an upset client.",
                "Adaptability": "Tell me about a time priorities changed quickly.",
                "Initiative/Growth": "Tell me about a time you improved a client support process.",
                "Role-Specific Scenario": "A client needs help while another task is urgent. What do you do first?"
            },
            culture: {
                "Positive Emotion": "What helps you stay positive during client-facing work?",
                "Engagement": "What parts of client service keep you focused?",
                "Relationships": "How do you build trust with clients and teammates?",
                "Meaning": "What makes client service work meaningful to you?",
                "Accomplishment": "What client support accomplishment are you proud of?"
            },
            technical: [
                { text: "How do you document client issues in a CRM?" }
            ],
            screening: {
                "Interest": "Why are you interested in this client service role?",
                "Background": "Give me a quick overview of your client service background.",
                "Availability": "What should we know about your schedule availability?"
            }
        });
        generateContentMock.mockResolvedValue({ text: providerText });

        const { POST } = await import("./route");
        const req = new Request("http://localhost/api/questions/generate", {
            method: "POST",
            body: JSON.stringify({
                role: "Client Service Coordinator",
                jobDescription: "Support clients, resolve urgent issues, and document follow-up.",
                interviewStage: "follow_up_final",
                questionCount: 7
            })
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(Object.keys(body.behavioral)).not.toContain("Role-Specific Scenario");
        expect(body.caseScenario).toEqual(expect.objectContaining({
            "Role-Specific Scenario": "A client needs help while another task is urgent. What do you do first?",
            "Case / Scenario 2": expect.stringContaining("Client Service Coordinator"),
        }));
        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            parsedOutput: expect.objectContaining({
                caseScenario: expect.objectContaining({
                    "Case / Scenario 2": expect.stringContaining("Client Service Coordinator")
                })
            })
        }));
    });

    it("accepts exact plan-shaped provider output without requiring the legacy fixed question pool", async () => {
        const providerText = JSON.stringify({
            behavioral: {},
            culture: {},
            technical: [],
            screening: {
                "Interest": "What interests you most about this client service role?"
            }
        });
        generateContentMock.mockResolvedValue({ text: providerText });

        const { POST } = await import("./route");
        const req = new Request("http://localhost/api/questions/generate", {
            method: "POST",
            body: JSON.stringify({
                role: "Client Service Specialist",
                jobDescription: "Help clients understand services and coordinate follow-up.",
                interviewStage: "initial_screening",
                questionCount: 1
            })
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(Object.keys(body.screening)).toEqual(["Interest"]);
        expect(Object.keys(body.behavioral)).toEqual([]);
        expect(Object.keys(body.culture)).toEqual([]);
        expect(body.technical).toEqual([]);
        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            promptSnapshot: expect.objectContaining({
                prompt: expect.stringContaining("Planned category mix: 1 Screening")
            }),
            parsedOutput: expect.objectContaining({
                screening: {
                    Interest: "What interests you most about this client service role?"
                }
            })
        }));
    });

    it("accepts multiple planned case questions without fixed legacy key requirements", async () => {
        const providerText = JSON.stringify({
            behavioral: {
                "Behavioral 1": "Tell me about a time you resolved a difficult client concern.",
                "Behavioral 2": "Tell me about a time you adapted to a sudden client need.",
            },
            caseScenario: {
                "Case / Scenario 1": "A client needs urgent help while another task is overdue. What do you do first?",
                "Case / Scenario 2": "A teammate misses a handoff and a client is waiting. How would you handle it?"
            },
            culture: {
                "Culture / Fit 1": "What kind of client-service team helps you do your best work?",
                "Culture / Fit 2": "How do you build trust with teammates during busy client-service work?"
            },
            technical: [
                { text: "How do you document a client issue so the next person can follow up?" }
            ],
            screening: {}
        });
        generateContentMock.mockResolvedValue({ text: providerText });

        const { POST } = await import("./route");
        const req = new Request("http://localhost/api/questions/generate", {
            method: "POST",
            body: JSON.stringify({
                role: "Client Service Coordinator",
                jobDescription: "Support clients, resolve urgent issues, and document follow-up.",
                interviewStage: "follow_up_final",
                questionCount: 7
            })
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(Object.keys(body.behavioral)).toEqual([
            "Behavioral 1",
            "Behavioral 2",
        ]);
        expect(Object.keys(body.caseScenario)).toEqual(["Case / Scenario 1", "Case / Scenario 2"]);
        expect(Object.keys(body.culture)).toEqual(["Culture / Fit 1", "Culture / Fit 2"]);
        expect(body.technical).toHaveLength(1);
        expect(Object.keys(body.screening)).toEqual([]);
    });

    it("returns a sanitized internal error when Gemini returns schema-invalid JSON", async () => {
        const providerText = JSON.stringify({
            behavioral: { "Conflict/Resolution": "" },
            culture: {},
            technical: [],
            screening: {},
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
            inputSnapshot: expect.objectContaining({
                role: "QA Engineer",
                hasJobDescription: false,
                hasResumeText: false,
            }),
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
