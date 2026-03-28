import { beforeEach, describe, expect, it, vi } from "vitest";
import { retryInviteBatch, InviteBatchRetryNotFoundError, InviteBatchRetryValidationError } from "./retry-invite-batch";

const createTrackedBatchMock = vi.fn();
const markTrackedBatchCompletedMock = vi.fn();
const markTrackedBatchFailedMock = vi.fn();
const createBatchMock = vi.fn();
const getTrackedBatchMock = vi.fn();
const markTrackedBatchRetriedMock = vi.fn();

const repository = {
    create: vi.fn(),
    createBatch: createBatchMock,
    getByToken: vi.fn(),
    createTrackedBatch: createTrackedBatchMock,
    markTrackedBatchCompleted: markTrackedBatchCompletedMock,
    markTrackedBatchFailed: markTrackedBatchFailedMock,
    getTrackedBatch: getTrackedBatchMock,
    markTrackedBatchRetried: markTrackedBatchRetriedMock
};

describe("retryInviteBatch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createTrackedBatchMock.mockResolvedValue("retry-batch-1");
        createBatchMock.mockResolvedValue(undefined);
        markTrackedBatchCompletedMock.mockResolvedValue(undefined);
        markTrackedBatchFailedMock.mockResolvedValue(undefined);
        markTrackedBatchRetriedMock.mockResolvedValue(undefined);
    });

    it("throws when the source batch does not exist", async () => {
        getTrackedBatchMock.mockResolvedValue(null);

        await expect(
            retryInviteBatch("missing-batch", "user-1", "https://app.example.com", { repository })
        ).rejects.toEqual(new InviteBatchRetryNotFoundError("Invite batch not found"));
    });

    it("throws when no retryable failed candidates remain", async () => {
        getTrackedBatchMock.mockResolvedValue({
            batchId: "batch-1",
            createdBy: "user-1",
            role: "QA Engineer",
            questions: [],
            status: "retry_issued",
            candidates: [{
                candidateIndex: 0,
                firstName: "Cand",
                lastName: "Date",
                email: "candidate@example.com",
                reqId: "REQ-1",
                status: "retry_issued",
                retryable: false,
                retryCount: 1
            }]
        });

        await expect(
            retryInviteBatch("batch-1", "user-1", "https://app.example.com", { repository })
        ).rejects.toEqual(new InviteBatchRetryValidationError("No retryable failed candidates remain for this batch"));
    });

    it("creates a child batch from failed retryable candidates and marks the source batch retried", async () => {
        getTrackedBatchMock.mockResolvedValue({
            batchId: "batch-1",
            createdBy: "user-1",
            role: "QA Engineer",
            jobDescription: "Own API quality",
            questions: [{
                text: "Tell me about a bug you found.",
                category: "STAR",
                index: 0
            }],
            status: "failed",
            candidates: [{
                candidateIndex: 0,
                firstName: "Cand",
                lastName: "Date",
                email: "candidate@example.com",
                reqId: "REQ-1",
                status: "failed",
                retryable: true,
                retryCount: 0
            }]
        });

        const result = await retryInviteBatch("batch-1", "user-1", "https://app.example.com", {
            repository,
            createSessionId: () => "session-retry-1",
            createToken: () => "retry-token-1"
        });

        expect(result.batchId).toBe("retry-batch-1");
        expect(result.retriedFromBatchId).toBe("batch-1");
        expect(result.results).toEqual([{
            status: "created",
            id: "session-retry-1",
            firstName: "Cand",
            lastName: "Date",
            email: "candidate@example.com",
            link: "https://app.example.com/s/retry-token-1"
        }]);
        expect(createTrackedBatchMock).toHaveBeenCalledWith(expect.objectContaining({
            parentBatchId: "batch-1",
            candidates: [{
                firstName: "Cand",
                lastName: "Date",
                email: "candidate@example.com",
                reqId: "REQ-1",
                resumeText: undefined
            }]
        }), expect.any(Array));
        expect(markTrackedBatchRetriedMock).toHaveBeenCalledWith("batch-1", "retry-batch-1");
    });
});
