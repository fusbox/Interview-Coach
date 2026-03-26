import { beforeEach, describe, expect, it, vi } from "vitest";
import { startSessionCommand } from "./start-session";
import { SessionStartAccessError, SessionStartNotFoundError } from "./errors";

const createMock = vi.fn();
const getMock = vi.fn();
const requireCandidateTokenMock = vi.fn();
const generateQuestionsMock = vi.fn();
const issueCandidateTokenMock = vi.fn();

describe("startSessionCommand", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createMock.mockResolvedValue(undefined);
        getMock.mockResolvedValue({ id: "parent-session", role: "QA Engineer", questions: [], answers: {}, currentQuestionIndex: 0, status: "NOT_STARTED" });
        requireCandidateTokenMock.mockResolvedValue({ ok: true, status: 200 });
        generateQuestionsMock.mockResolvedValue([]);
        issueCandidateTokenMock.mockResolvedValue("candidate-token");
    });

    it("creates a new session and issues a candidate token", async () => {
        const result = await startSessionCommand(
            new Request("http://localhost/api/session/start", { method: "POST" }),
            { role: "QA Engineer" },
            {
                repository: { get: getMock, create: createMock },
                requireCandidateToken: requireCandidateTokenMock,
                generateQuestions: generateQuestionsMock,
                issueCandidateToken: issueCandidateTokenMock,
            }
        );

        expect(generateQuestionsMock).toHaveBeenCalledWith("QA Engineer");
        expect(createMock).toHaveBeenCalledTimes(1);
        expect(result.candidateToken).toBe("candidate-token");
    });

    it("throws an access error when clone auth fails", async () => {
        requireCandidateTokenMock.mockResolvedValue({ ok: false, status: 401, error: "Missing candidate token" });

        await expect(
            startSessionCommand(
                new Request("http://localhost/api/session/start", { method: "POST" }),
                { role: "QA Engineer", parentId: "550e8400-e29b-41d4-a716-446655440000" },
                {
                    repository: { get: getMock, create: createMock },
                    requireCandidateToken: requireCandidateTokenMock,
                    generateQuestions: generateQuestionsMock,
                    issueCandidateToken: issueCandidateTokenMock,
                }
            )
        ).rejects.toEqual(new SessionStartAccessError("Missing candidate token", 401));
    });

    it("throws when the clone parent session is missing", async () => {
        getMock.mockResolvedValue(null);

        await expect(
            startSessionCommand(
                new Request("http://localhost/api/session/start", { method: "POST" }),
                { role: "QA Engineer", parentId: "550e8400-e29b-41d4-a716-446655440000" },
                {
                    repository: { get: getMock, create: createMock },
                    requireCandidateToken: requireCandidateTokenMock,
                    generateQuestions: generateQuestionsMock,
                    issueCandidateToken: issueCandidateTokenMock,
                }
            )
        ).rejects.toEqual(new SessionStartNotFoundError("Parent session not found"));
    });
});
