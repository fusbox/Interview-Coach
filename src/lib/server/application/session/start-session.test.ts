import { beforeEach, describe, expect, it, vi } from "vitest";
import { startSessionCommand } from "./start-session";
import { SessionStartAccessError, SessionStartNotFoundError } from "./errors";

const createMock = vi.fn();
const getMock = vi.fn();
const updateMock = vi.fn();
const requireCandidateTokenMock = vi.fn();
const generateQuestionsMock = vi.fn();
const issueCandidateTokenMock = vi.fn();

describe("startSessionCommand", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createMock.mockResolvedValue(undefined);
        updateMock.mockResolvedValue(undefined);
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
                repository: { get: getMock, create: createMock, update: updateMock },
                requireCandidateToken: requireCandidateTokenMock,
                generateQuestions: generateQuestionsMock,
                issueCandidateToken: issueCandidateTokenMock,
            }
        );

        expect(generateQuestionsMock).toHaveBeenCalledWith("QA Engineer");
        expect(createMock).toHaveBeenCalledTimes(1);
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            inviteToken: "candidate-token",
        }));
        expect(result.candidateToken).toBe("candidate-token");
        expect(result.session.inviteToken).toBe("candidate-token");
    });

    it("stores the issued token on cloned attempts so practice-again can chain", async () => {
        getMock.mockResolvedValue({
            id: "parent-session",
            role: "QA Engineer",
            questions: [{ id: "question-1", text: "Question?", category: "General", index: 0 }],
            answers: {},
            currentQuestionIndex: 0,
            status: "COMPLETED",
            initialsRequired: false,
            inviteToken: "parent-token",
            attemptNumber: 2,
        });

        const result = await startSessionCommand(
            new Request("http://localhost/api/session/start", { method: "POST" }),
            { role: "QA Engineer", parentId: "550e8400-e29b-41d4-a716-446655440000" },
            {
                repository: { get: getMock, create: createMock, update: updateMock },
                requireCandidateToken: requireCandidateTokenMock,
                generateQuestions: generateQuestionsMock,
                issueCandidateToken: issueCandidateTokenMock,
            }
        );

        expect(requireCandidateTokenMock).toHaveBeenCalledWith(expect.any(Request), "550e8400-e29b-41d4-a716-446655440000");
        expect(generateQuestionsMock).not.toHaveBeenCalled();
        expect(result.session).toEqual(expect.objectContaining({
            parentSessionId: "parent-session",
            attemptNumber: 3,
            inviteToken: "candidate-token",
        }));
        expect(result.session.inviteToken).not.toBe("parent-token");
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            id: result.session.id,
            inviteToken: "candidate-token",
        }));
    });

    it("throws an access error when clone auth fails", async () => {
        requireCandidateTokenMock.mockResolvedValue({ ok: false, status: 401, error: "Missing candidate token" });

        await expect(
            startSessionCommand(
                new Request("http://localhost/api/session/start", { method: "POST" }),
                { role: "QA Engineer", parentId: "550e8400-e29b-41d4-a716-446655440000" },
                {
                    repository: { get: getMock, create: createMock, update: updateMock },
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
                    repository: { get: getMock, create: createMock, update: updateMock },
                    requireCandidateToken: requireCandidateTokenMock,
                    generateQuestions: generateQuestionsMock,
                    issueCandidateToken: issueCandidateTokenMock,
                }
            )
        ).rejects.toEqual(new SessionStartNotFoundError("Parent session not found"));
    });
});
