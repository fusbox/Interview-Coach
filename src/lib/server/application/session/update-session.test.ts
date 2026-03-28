import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InterviewSession } from "@/lib/domain/types";
import { updateSessionCommand } from "./update-session";
import { SessionUpdateNotFoundError, SessionUpdateValidationError } from "./errors";

const getMock = vi.fn();
const updatePartialMock = vi.fn();
const setSummaryExpiryMock = vi.fn();
const summarizeSessionMock = vi.fn();
const sendDebriefEmailMock = vi.fn();
const incrementMetricMock = vi.fn();

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

describe("updateSessionCommand", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updatePartialMock.mockResolvedValue(undefined);
        setSummaryExpiryMock.mockResolvedValue(undefined);
        summarizeSessionMock.mockResolvedValue("Summary text");
        sendDebriefEmailMock.mockResolvedValue({ id: "email-1" });
    });

    it("throws when the session is missing before update", async () => {
        getMock.mockResolvedValue(null);

        await expect(
            updateSessionCommand("missing-session", { status: "COMPLETED" }, {
                repository: {
                    get: getMock,
                    updatePartial: updatePartialMock,
                    setSummaryExpiry: setSummaryExpiryMock
                },
                summarizeSession: summarizeSessionMock,
                sendDebriefEmail: sendDebriefEmailMock,
                incrementMetric: incrementMetricMock,
                now: () => 1000
            })
        ).rejects.toEqual(new SessionUpdateNotFoundError("Session not found"));
    });

    it("throws when the requested status transition is invalid", async () => {
        getMock.mockResolvedValue(createSession({ status: "NOT_STARTED" }));

        await expect(
            updateSessionCommand("session-1", { status: "COMPLETED" }, {
                repository: {
                    get: getMock,
                    updatePartial: updatePartialMock,
                    setSummaryExpiry: setSummaryExpiryMock
                },
                summarizeSession: summarizeSessionMock,
                sendDebriefEmail: sendDebriefEmailMock,
                incrementMetric: incrementMetricMock,
                now: () => 1000
            })
        ).rejects.toEqual(new SessionUpdateValidationError("Invalid session status transition: NOT_STARTED -> COMPLETED"));
    });

    it("returns the updated session without summary side effects for non-completion updates", async () => {
        getMock
            .mockResolvedValueOnce(createSession({ status: "IN_SESSION" }))
            .mockResolvedValueOnce(createSession({ status: "PAUSED" }));

        const result = await updateSessionCommand("session-1", { status: "PAUSED" }, {
            repository: {
                get: getMock,
                updatePartial: updatePartialMock,
                setSummaryExpiry: setSummaryExpiryMock
            },
            summarizeSession: summarizeSessionMock,
            sendDebriefEmail: sendDebriefEmailMock,
            incrementMetric: incrementMetricMock,
            now: () => 1000
        });

        expect(updatePartialMock).toHaveBeenCalledWith("session-1", { status: "PAUSED" });
        expect(result.status).toBe("PAUSED");
        expect(summarizeSessionMock).not.toHaveBeenCalled();
        expect(sendDebriefEmailMock).not.toHaveBeenCalled();
        expect(incrementMetricMock).not.toHaveBeenCalled();
    });

    it("summarizes, emails, and sets expiry when the session completes", async () => {
        getMock
            .mockResolvedValueOnce(createSession({ status: "IN_SESSION" }))
            .mockResolvedValueOnce(createSession({ status: "COMPLETED", summaryNarrative: undefined }));

        const result = await updateSessionCommand("session-1", { status: "COMPLETED" }, {
            repository: {
                get: getMock,
                updatePartial: updatePartialMock,
                setSummaryExpiry: setSummaryExpiryMock
            },
            summarizeSession: summarizeSessionMock,
            sendDebriefEmail: sendDebriefEmailMock,
            incrementMetric: incrementMetricMock,
            now: () => 5000
        });

        expect(incrementMetricMock).toHaveBeenCalledWith("session_completion_total", { outcome: "success" });
        expect(summarizeSessionMock).toHaveBeenCalledTimes(1);
        expect(updatePartialMock).toHaveBeenNthCalledWith(1, "session-1", { status: "COMPLETED" });
        expect(updatePartialMock).toHaveBeenNthCalledWith(2, "session-1", { summaryNarrative: "Summary text" });
        expect(sendDebriefEmailMock).toHaveBeenCalledWith(expect.objectContaining({ summaryNarrative: "Summary text" }));
        expect(setSummaryExpiryMock).toHaveBeenCalledWith("session-1", 21605000);
        expect(result.summaryNarrative).toBe("Summary text");
    });

    it("returns the updated session when summarization fails", async () => {
        getMock
            .mockResolvedValueOnce(createSession({ status: "IN_SESSION" }))
            .mockResolvedValueOnce(createSession({ status: "COMPLETED", summaryNarrative: undefined }));
        summarizeSessionMock.mockRejectedValue(new Error("AI down"));

        const result = await updateSessionCommand("session-1", { status: "COMPLETED" }, {
            repository: {
                get: getMock,
                updatePartial: updatePartialMock,
                setSummaryExpiry: setSummaryExpiryMock
            },
            summarizeSession: summarizeSessionMock,
            sendDebriefEmail: sendDebriefEmailMock,
            incrementMetric: incrementMetricMock,
            now: () => 5000
        });

        expect(result.summaryNarrative).toBeUndefined();
        expect(sendDebriefEmailMock).not.toHaveBeenCalled();
        expect(setSummaryExpiryMock).not.toHaveBeenCalled();
    });
});
