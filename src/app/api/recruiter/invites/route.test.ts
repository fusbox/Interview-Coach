import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedRouteUserMock = vi.fn();
const createInviteBatchMock = vi.fn();
const consumeRateLimitMock = vi.fn();
const beginIdempotentRequestMock = vi.fn();
const completeIdempotentRequestMock = vi.fn();
const releaseIdempotentRequestMock = vi.fn();

vi.mock("@/lib/server/auth/current-user", () => ({
    getAuthenticatedRouteUser: getAuthenticatedRouteUserMock
}));

vi.mock("@/lib/supabase/server", () => ({
    createAdminClient: () => ({
        rpc: vi.fn().mockResolvedValue({ data: null, error: null })
    })
}));

vi.mock("@/lib/server/application/invites/create-invite-batch", () => ({
    createInviteBatch: createInviteBatchMock
}));

vi.mock("@/lib/server/rate-limit", () => ({
    consumeRateLimit: consumeRateLimitMock
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

const validPayload = {
    role: "QA Engineer",
    jobDescription: "Own API quality",
    candidates: [{
        firstName: "Cand",
        lastName: "Date",
        email: "candidate@example.com",
        reqId: "REQ-1"
    }],
    questions: [{
        text: "Tell me about a bug you found.",
        category: "STAR",
        index: 0
    }]
};

describe("POST /api/recruiter/invites", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getAuthenticatedRouteUserMock.mockResolvedValue({ id: "user-1", email: "recruiter@example.com" });
        createInviteBatchMock.mockResolvedValue({
            batchId: "batch-1",
            results: [{
                status: "created",
                id: "session-1",
                firstName: "Cand",
                lastName: "Date",
                email: "candidate@example.com",
                link: "https://app.example.com/s/token-1"
            }],
            failures: [],
            summary: {
                requested: 1,
                succeeded: 1,
                failed: 0,
                hasFailures: false
            }
        });
        consumeRateLimitMock.mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
        beginIdempotentRequestMock.mockResolvedValue({ kind: "acquired" });
        completeIdempotentRequestMock.mockResolvedValue(undefined);
        releaseIdempotentRequestMock.mockResolvedValue(undefined);
        vi.stubEnv("NODE_ENV", "test");
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    });

    it("returns 401 when unauthenticated even in development", async () => {
        vi.stubEnv("NODE_ENV", "development");
        getAuthenticatedRouteUserMock.mockResolvedValue(null);
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/recruiter/invites", {
            method: "POST",
            body: JSON.stringify(validPayload)
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.code).toBe("UNAUTHORIZED");
        expect(createInviteBatchMock).not.toHaveBeenCalled();
    });

    it("returns 400 when payload is invalid", async () => {
        const { POST } = await import("./route");
        const req = new Request("http://localhost/api/recruiter/invites", {
            method: "POST",
            body: JSON.stringify({ role: "QA Engineer", candidates: [] })
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.code).toBe("INVALID_REQUEST");
        expect(createInviteBatchMock).not.toHaveBeenCalled();
    });

    it("returns 429 when rate limited", async () => {
        consumeRateLimitMock
            .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 })
            .mockResolvedValueOnce({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/recruiter/invites", {
            method: "POST",
            body: JSON.stringify(validPayload)
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(429);
        expect(body.code).toBe("RATE_LIMITED");
        expect(createInviteBatchMock).not.toHaveBeenCalled();
    });

    it("replays the saved response for a duplicate idempotency key", async () => {
        beginIdempotentRequestMock.mockResolvedValue({
            kind: "replay",
            statusCode: 200,
            body: {
                batchId: "batch-existing",
                results: [{ id: "existing", firstName: "Cand", lastName: "Date", email: "candidate@example.com", link: "https://app.example.com/s/token" }],
                correlationId: "corr-existing"
            }
        });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/recruiter/invites", {
            method: "POST",
            headers: { "Idempotency-Key": "same-key" },
            body: JSON.stringify(validPayload)
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.correlationId).toBe("corr-existing");
        expect(createInviteBatchMock).not.toHaveBeenCalled();
        expect(completeIdempotentRequestMock).not.toHaveBeenCalled();
    });

    it("returns 200 for a valid authenticated request and stores the idempotent response", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/recruiter/invites", {
            method: "POST",
            headers: { "Idempotency-Key": "create-key-1" },
            body: JSON.stringify(validPayload)
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.batchId).toBe("batch-1");
        expect(body.results).toHaveLength(1);
        expect(body.results[0].email).toBe("candidate@example.com");
        expect(body.results[0].link).toBe("https://app.example.com/s/token-1");
        expect(beginIdempotentRequestMock).toHaveBeenCalledWith(expect.objectContaining({
            scope: "recruiter_invites:create",
            actorId: "user-1",
            key: "create-key-1"
        }));
        expect(createInviteBatchMock).toHaveBeenCalledTimes(1);
        expect(completeIdempotentRequestMock).toHaveBeenCalledWith(expect.objectContaining({
            scope: "recruiter_invites:create",
            actorId: "user-1",
            key: "create-key-1",
            statusCode: 200
        }));
    });

    it("returns 207 with deterministic batch failures when the atomic batch write fails", async () => {
        createInviteBatchMock.mockResolvedValueOnce({
            batchId: "batch-failed",
            results: [],
            failures: [
                {
                    status: "failed",
                    firstName: "Cand",
                    lastName: "Date",
                    email: "candidate@example.com",
                    code: "INVITE_CREATE_FAILED",
                    message: "Supabase Invite Batch Create Error: duplicate key",
                    retryable: true,
                },
                {
                    status: "failed",
                    firstName: "Pat",
                    lastName: "Chy",
                    email: "patchy@example.com",
                    code: "INVITE_CREATE_FAILED",
                    message: "Supabase Invite Batch Create Error: duplicate key",
                    retryable: true,
                },
            ],
            summary: {
                requested: 2,
                succeeded: 0,
                failed: 2,
                hasFailures: true,
            }
        });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/recruiter/invites", {
            method: "POST",
            headers: { "Idempotency-Key": "create-key-partial" },
            body: JSON.stringify({
                ...validPayload,
                candidates: [
                    validPayload.candidates[0],
                    {
                        firstName: "Pat",
                        lastName: "Chy",
                        email: "patchy@example.com",
                        reqId: "REQ-2",
                    },
                ],
            })
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(207);
        expect(body.results).toEqual([]);
        expect(body).toEqual({
            batchId: "batch-failed",
            results: [],
            failures: [
                {
                    status: "failed",
                    firstName: "Cand",
                    lastName: "Date",
                    email: "candidate@example.com",
                    code: "INVITE_CREATE_FAILED",
                    message: "Supabase Invite Batch Create Error: duplicate key",
                    retryable: true,
                },
                {
                    status: "failed",
                    firstName: "Pat",
                    lastName: "Chy",
                    email: "patchy@example.com",
                    code: "INVITE_CREATE_FAILED",
                    message: "Supabase Invite Batch Create Error: duplicate key",
                    retryable: true,
                },
            ],
            summary: {
                requested: 2,
                succeeded: 0,
                failed: 2,
                hasFailures: true,
            },
            correlationId: expect.any(String),
        });
        expect(body.failures).toEqual([
            {
                status: "failed",
                firstName: "Cand",
                lastName: "Date",
                email: "candidate@example.com",
                code: "INVITE_CREATE_FAILED",
                message: "Supabase Invite Batch Create Error: duplicate key",
                retryable: true,
            },
            {
                status: "failed",
                firstName: "Pat",
                lastName: "Chy",
                email: "patchy@example.com",
                code: "INVITE_CREATE_FAILED",
                message: "Supabase Invite Batch Create Error: duplicate key",
                retryable: true,
            },
        ]);
        expect(body.summary).toEqual({
            requested: 2,
            succeeded: 0,
            failed: 2,
            hasFailures: true,
        });
        expect(completeIdempotentRequestMock).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 207,
        }));
    });

    it("replays a stored partial-failure response for a duplicate idempotency key", async () => {
        beginIdempotentRequestMock.mockResolvedValue({
            kind: "replay",
            statusCode: 207,
            body: {
                batchId: "batch-partial",
                results: [{ id: "existing", firstName: "Cand", lastName: "Date", email: "candidate@example.com", link: "https://app.example.com/s/token" }],
                failures: [{
                    status: "failed",
                    firstName: "Pat",
                    lastName: "Chy",
                    email: "patchy@example.com",
                    code: "INVITE_CREATE_FAILED",
                    message: "Supabase Session Create Error: duplicate key",
                    retryable: true,
                }],
                summary: {
                    requested: 2,
                    succeeded: 1,
                    failed: 1,
                    hasFailures: true,
                },
                correlationId: "corr-partial",
            }
        });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/recruiter/invites", {
            method: "POST",
            headers: { "Idempotency-Key": "same-key-partial" },
            body: JSON.stringify(validPayload)
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(207);
        expect(body).toEqual({
            batchId: "batch-partial",
            results: [{
                id: "existing",
                firstName: "Cand",
                lastName: "Date",
                email: "candidate@example.com",
                link: "https://app.example.com/s/token",
            }],
            failures: [{
                status: "failed",
                firstName: "Pat",
                lastName: "Chy",
                email: "patchy@example.com",
                code: "INVITE_CREATE_FAILED",
                message: "Supabase Session Create Error: duplicate key",
                retryable: true,
            }],
            summary: {
                requested: 2,
                succeeded: 1,
                failed: 1,
                hasFailures: true,
            },
            correlationId: "corr-partial",
        });
        expect(createInviteBatchMock).not.toHaveBeenCalled();
        expect(completeIdempotentRequestMock).not.toHaveBeenCalled();
    });

    it("normalizes a local 0.0.0.0 request origin to localhost when no app url is configured", async () => {
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
        vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
        createInviteBatchMock.mockResolvedValueOnce({
            batchId: "batch-local",
            results: [{
                status: "created",
                id: "session-local",
                firstName: "Cand",
                lastName: "Date",
                email: "candidate@example.com",
                link: "http://localhost:3000/s/token-local"
            }],
            failures: [],
            summary: {
                requested: 1,
                succeeded: 1,
                failed: 0,
                hasFailures: false
            }
        });
        const { POST } = await import("./route");

        const req = new Request("http://0.0.0.0:3000/api/recruiter/invites", {
            method: "POST",
            headers: { "Idempotency-Key": "create-key-localhost" },
            body: JSON.stringify(validPayload)
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.results[0].link).toMatch(/^http:\/\/localhost:3000\/s\//);
    });

    it("returns 500 in production when NEXT_PUBLIC_APP_URL is missing", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("METRICS_BACKEND", "supabase");
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
        vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
        const { POST } = await import("./route");

        const req = new Request("https://untrusted.example.com/api/recruiter/invites", {
            method: "POST",
            headers: { "Idempotency-Key": "create-key-prod-origin" },
            body: JSON.stringify(validPayload)
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.code).toBe("INTERNAL_ERROR");
        expect(createInviteBatchMock).not.toHaveBeenCalled();
    });
});
