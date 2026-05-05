import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
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

vi.mock("@/lib/server/services/ai-config", () => ({
    ai: null,
    AI_MODELS: {
        QUESTION_GEN: "mock-model"
    }
}));

vi.mock("@/lib/server/ai-quality/capture-ai-generation", () => ({
    captureAiGeneration: captureAiGenerationMock
}));

describe("POST /api/questions/generate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        captureAiGenerationMock.mockResolvedValue("generation-1");
    });

    it("returns 401 when recruiter auth is missing", async () => {
        getUserMock.mockResolvedValue({ data: { user: null }, error: null });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/questions/generate", {
            method: "POST",
            body: JSON.stringify({ role: "QA Engineer" })
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.code).toBe("UNAUTHORIZED");
    });

    it("returns 400 when the request body is missing a valid role", async () => {
        getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/questions/generate", {
            method: "POST",
            body: JSON.stringify({ role: "" })
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body).toMatchObject({
            code: "INVALID_REQUEST",
            message: "Invalid request",
            retryable: false
        });
    });

    it("captures mock fallback generations when the AI provider is not configured", async () => {
        getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/questions/generate", {
            method: "POST",
            body: JSON.stringify({
                role: "Warehouse Associate",
                jobDescription: "Pick, pack, and stage warehouse orders.",
                resume: "Previous forklift and inventory experience."
            })
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.behavioral).toBeDefined();
        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            appName: "recruiter_app",
            surface: "question_generation",
            status: "success",
            modelProvider: "mock",
            modelName: "mock-question-generator",
            inputSnapshot: {
                role: "Warehouse Associate",
                hasJobDescription: true,
                hasResumeText: true
            },
            contextArtifacts: [
                expect.objectContaining({
                    type: "job_description",
                    content: "Pick, pack, and stage warehouse orders."
                }),
                expect.objectContaining({
                    type: "resume",
                    content: "Previous forklift and inventory experience."
                })
            ],
            privacyFlags: ["contains_resume"],
            redactionStatus: "redacted",
            retentionClass: "eval_redacted",
            createdBy: "user-1",
        }));
    });
});
