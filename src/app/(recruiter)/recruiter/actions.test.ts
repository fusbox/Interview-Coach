import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionSummary } from "@/lib/domain/types";

const getCachedUserMock = vi.fn();
const redirectMock = vi.fn();
const deleteMock = vi.fn();
const revalidatePathMock = vi.fn();
const listByRecruiterMock = vi.fn();

vi.mock("@/lib/server/auth/current-user", () => ({
    getCachedUser: getCachedUserMock
}));

vi.mock("next/navigation", () => ({
    redirect: redirectMock
}));

vi.mock("next/cache", () => ({
    revalidatePath: revalidatePathMock
}));

vi.mock("@/lib/server/infrastructure/postgres-session-repository", () => ({
    PostgresSessionRepository: class {
        listByRecruiter = listByRecruiterMock;
        delete = deleteMock;
    }
}));

describe("recruiter actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCachedUserMock.mockResolvedValue({ id: "recruiter-1", email: "recruiter@example.com" });
    });

    it("resolves anonymous child attempts from their parent and sorts newest first", async () => {
        const sessions: SessionSummary[] = [
            {
                id: "parent-1",
                candidateName: "Cand Date",
                role: "QA Engineer",
                status: "COMPLETED",
                createdAt: 100,
                updatedAt: 150,
                questionCount: 3,
                answerCount: 3,
                submittedCount: 3
            },
            {
                id: "attempt-2",
                candidateName: "Anonymous Candidate",
                role: "QA Engineer",
                status: "IN_SESSION",
                createdAt: 200,
                updatedAt: 220,
                questionCount: 3,
                answerCount: 1,
                submittedCount: 1,
                parentSessionId: "parent-1",
                attemptNumber: 2
            }
        ];
        listByRecruiterMock.mockResolvedValue(sessions);

        const { getRecruiterSessions } = await import("./actions");
        const result = await getRecruiterSessions();

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe("attempt-2");
        expect(result[0].candidateName).toBe("Cand Date");
        expect(result[1].id).toBe("parent-1");
    });

    it("deletes a session and revalidates the recruiter dashboard path", async () => {
        deleteMock.mockResolvedValue(undefined);

        const { deleteSession } = await import("./actions");
        await deleteSession("session-1");

        expect(deleteMock).toHaveBeenCalledWith("session-1");
        expect(revalidatePathMock).toHaveBeenCalledWith("/recruiter");
    });
});
