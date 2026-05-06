import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const createSessionMock = vi.fn();
const addQuestionsMock = vi.fn();
const cloneSessionMock = vi.fn();
const generateQuestionsMock = vi.fn();
const createRepoMock = vi.fn();
const issueCandidateTokenMock = vi.fn();
const requireCandidateTokenMock = vi.fn();

vi.mock("@/lib/server/infrastructure/postgres-session-repository", () => ({
    PostgresSessionRepository: class {
        get = getSessionMock;
        create = createRepoMock;
    }
}));

vi.mock("@/lib/server/session/orchestrator", () => ({
    createSession: createSessionMock,
    addQuestions: addQuestionsMock,
    cloneSession: cloneSessionMock,
}));

vi.mock("@/lib/server/services/question-service", () => ({
    QuestionService: {
        generateQuestions: generateQuestionsMock
    }
}));

vi.mock("@/lib/server/auth/candidate-token", () => ({
    requireCandidateToken: requireCandidateTokenMock,
    issueCandidateToken: issueCandidateTokenMock
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe("POST /api/session/start", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireCandidateTokenMock.mockResolvedValue({ ok: true, status: 200 });
        issueCandidateTokenMock.mockResolvedValue("new-token");
        cloneSessionMock.mockReturnValue({ id: "child-session", role: "QA Engineer" });
        getSessionMock.mockResolvedValue({ id: "parent-session", role: "QA Engineer" });
        createRepoMock.mockResolvedValue(undefined);
        createSessionMock.mockReturnValue({ id: "new-session", role: "QA Engineer" });
        addQuestionsMock.mockImplementation((session) => session);
        generateQuestionsMock.mockResolvedValue([]);
    });

    it("returns 401 when cloning without the current candidate token", async () => {
        requireCandidateTokenMock.mockResolvedValue({ ok: false, status: 401, error: "Missing candidate token" });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/start", {
            method: "POST",
            body: JSON.stringify({ role: "QA Engineer", parentId: "550e8400-e29b-41d4-a716-446655440000" })
        });

        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.code).toBe("UNAUTHORIZED");
        expect(getSessionMock).not.toHaveBeenCalled();
    });
});
