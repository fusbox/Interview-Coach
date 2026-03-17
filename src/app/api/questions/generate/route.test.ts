import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();

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

describe("POST /api/questions/generate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
});
