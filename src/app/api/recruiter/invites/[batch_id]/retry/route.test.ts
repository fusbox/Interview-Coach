import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedRouteUserMock = vi.fn();
const retryInviteBatchMock = vi.fn();
const beginIdempotentRequestMock = vi.fn();
const completeIdempotentRequestMock = vi.fn();
const releaseIdempotentRequestMock = vi.fn();

vi.mock("@/lib/server/auth/current-user", () => ({
    getAuthenticatedRouteUser: getAuthenticatedRouteUserMock
}));

vi.mock("@/lib/server/application/invites/retry-invite-batch", () => ({
    retryInviteBatch: retryInviteBatchMock,
    InviteBatchRetryNotFoundError: class InviteBatchRetryNotFoundError extends Error {},
    InviteBatchRetryValidationError: class InviteBatchRetryValidationError extends Error {}
}));

vi.mock("@/lib/server/idempotency", () => ({
    beginIdempotentRequest: beginIdempotentRequestMock,
    completeIdempotentRequest: completeIdempotentRequestMock,
    releaseIdempotentRequest: releaseIdempotentRequestMock
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe("POST /api/recruiter/invites/[batch_id]/retry", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getAuthenticatedRouteUserMock.mockResolvedValue({ id: "user-1", email: "recruiter@example.com" });
        beginIdempotentRequestMock.mockResolvedValue({ kind: "acquired" });
        completeIdempotentRequestMock.mockResolvedValue(undefined);
        releaseIdempotentRequestMock.mockResolvedValue(undefined);
        retryInviteBatchMock.mockResolvedValue({
            batchId: "retry-batch-1",
            retriedFromBatchId: "batch-1",
            results: [{
                status: "created",
                id: "session-1",
                firstName: "Cand",
                lastName: "Date",
                email: "candidate@example.com",
                link: "https://app.example.com/s/token"
            }],
            failures: [],
            summary: {
                requested: 1,
                succeeded: 1,
                failed: 0,
                hasFailures: false
            }
        });
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    });

    it("returns 401 when unauthenticated", async () => {
        getAuthenticatedRouteUserMock.mockResolvedValue(null);
        const { POST } = await import("./route");

        const res = await POST(
            new Request("http://localhost/api/recruiter/invites/batch-1/retry", { method: "POST" }) as never,
            { params: Promise.resolve({ batch_id: "batch-1" }) }
        );

        expect(res.status).toBe(401);
        expect(retryInviteBatchMock).not.toHaveBeenCalled();
    });

    it("returns the retried batch result", async () => {
        const { POST } = await import("./route");

        const res = await POST(
            new Request("http://localhost/api/recruiter/invites/batch-1/retry", { method: "POST" }) as never,
            { params: Promise.resolve({ batch_id: "batch-1" }) }
        );

        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.batchId).toBe("retry-batch-1");
        expect(body.retriedFromBatchId).toBe("batch-1");
        expect(retryInviteBatchMock).toHaveBeenCalledWith("batch-1", "user-1", "https://app.example.com");
        expect(completeIdempotentRequestMock).toHaveBeenCalledWith(expect.objectContaining({
            scope: "recruiter_invites:retry",
            actorId: "user-1",
            key: "retry:batch-1",
            statusCode: 200
        }));
    });
});
