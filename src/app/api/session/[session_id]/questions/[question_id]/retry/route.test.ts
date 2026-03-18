import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();

const session = {
    id: "session-1",
    status: "REVIEWING",
    role: "QA Engineer",
    questions: [{ id: "question-1", text: "Q1", index: 0, category: "Tech" }],
    currentQuestionIndex: 0,
    answers: {
        "question-1": {
            transcript: "old answer",
            submittedAt: "2026-03-17T00:00:00.000Z",
            analysis: { summary: "done" }
        }
    },
    initialsRequired: false
};

vi.mock("@/lib/server/api-handler-utils", () => ({
    validatedSessionHandler: (
        request: Request,
        params: { session_id: string; question_id: string },
        handler: (
            request: Request,
            context: {
                params: { session_id: string; question_id: string };
                session: typeof session;
                correlationId: string;
            }
        ) => Promise<Response>
    ) => handler(request, { params, session, correlationId: "corr-1" })
}));

vi.mock("@/lib/server/infrastructure/supabase-session-repository", () => ({
    SupabaseSessionRepository: class {
        update = updateMock;
    }
}));

describe("POST /api/session/[session_id]/questions/[question_id]/retry", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateMock.mockResolvedValue(undefined);
    });

    it("returns 400 for invalid retry payloads", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/retry", {
            method: "POST",
            body: JSON.stringify({ retryContext: { trigger: "coach", focus: ["clarity"] } })
        });

        const res = await POST(req, { params: Promise.resolve({ session_id: "session-1", question_id: "question-1" }) });
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.code).toBe("INVALID_REQUEST");
        expect(updateMock).not.toHaveBeenCalled();
    });
});
