import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const generateContentMock = vi.fn();
const incrementMetricMock = vi.fn();
const observeMetricMock = vi.fn();
const routeLoggerErrorMock = vi.fn();

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

describe("POST /api/questions/generate provider validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    });

    it("returns a sanitized internal error when Gemini returns schema-invalid JSON", async () => {
        generateContentMock.mockResolvedValue({
            text: JSON.stringify({
                behavioral: { "Conflict/Resolution": "only one key" }
            })
        });

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
