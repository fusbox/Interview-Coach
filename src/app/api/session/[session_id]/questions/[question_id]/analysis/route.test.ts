import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();
const analyzeAnswerMock = vi.fn();

const session = {
    id: "session-1",
    status: "AWAITING_EVALUATION",
    role: "QA Engineer",
    intakeData: {},
    questions: [{ id: "question-1", text: "Q1", index: 0, category: "Tech" }],
    currentQuestionIndex: 0,
    answers: {
        "question-1": {
            transcript: "old answer",
            submittedAt: "2026-03-17T00:00:00.000Z"
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

vi.mock("@/lib/server/services/ai-service", () => ({
    AIService: {
        analyzeAnswer: analyzeAnswerMock
    }
}));

describe("POST /api/session/[session_id]/questions/[question_id]/analysis", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateMock.mockResolvedValue(undefined);
        analyzeAnswerMock.mockResolvedValue({
            transcript: "normalized transcript",
            summary: "analysis"
        });
    });

    it("returns 400 for invalid analysis payloads", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/analysis", {
            method: "POST",
            body: JSON.stringify({ audioData: { mimeType: "audio/webm" } })
        });

        const res = await POST(req, { params: { session_id: "session-1", question_id: "question-1" } });
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.code).toBe("INVALID_REQUEST");
        expect(analyzeAnswerMock).not.toHaveBeenCalled();
        expect(updateMock).not.toHaveBeenCalled();
    });
});
