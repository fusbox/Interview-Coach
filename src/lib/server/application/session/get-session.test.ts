import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InterviewSession } from "@/lib/domain/types";
import { getSessionCommand } from "./get-session";
import { SessionUpdateNotFoundError } from "./errors";

const getMock = vi.fn();
const markViewedMock = vi.fn();

function createSession(overrides: Partial<InterviewSession> = {}): InterviewSession {
    return {
        id: "session-1",
        recruiterId: "recruiter-1",
        status: "IN_SESSION",
        role: "QA Engineer",
        jobDescription: "Test software",
        currentQuestionIndex: 0,
        questions: [],
        answers: {},
        initialsRequired: false,
        candidateName: "Jane Candidate",
        candidate: {
            firstName: "Jane",
            lastName: "Candidate",
            email: "jane@example.com"
        },
        ...overrides
    };
}

describe("getSessionCommand", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        markViewedMock.mockResolvedValue(undefined);
    });

    it("throws when the session is missing", async () => {
        getMock.mockResolvedValue(null);

        await expect(
            getSessionCommand("missing-session", {
                repository: {
                    get: getMock,
                    markViewed: markViewedMock
                }
            })
        ).rejects.toEqual(new SessionUpdateNotFoundError("Session not found"));
    });

    it("returns the session and schedules mark-viewed", async () => {
        const session = createSession();
        getMock.mockResolvedValue(session);

        const result = await getSessionCommand("session-1", {
            repository: {
                get: getMock,
                markViewed: markViewedMock
            }
        });

        expect(result).toBe(session);
        expect(markViewedMock).toHaveBeenCalledWith("session-1");
    });
});
