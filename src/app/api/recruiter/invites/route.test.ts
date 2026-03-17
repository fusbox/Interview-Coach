import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const createInviteMock = vi.fn();
const consumeRateLimitMock = vi.fn();
const beginIdempotentRequestMock = vi.fn();
const completeIdempotentRequestMock = vi.fn();
const releaseIdempotentRequestMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createClient: () => ({
        auth: {
            getUser: getUserMock
        }
    })
}));

vi.mock("@/lib/server/infrastructure/supabase-invite-repository", () => ({
    SupabaseInviteRepository: class {
        create = createInviteMock;
    }
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
        getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        createInviteMock.mockResolvedValue(undefined);
        consumeRateLimitMock.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
        beginIdempotentRequestMock.mockResolvedValue({ kind: "acquired" });
        completeIdempotentRequestMock.mockResolvedValue(undefined);
        releaseIdempotentRequestMock.mockResolvedValue(undefined);
        vi.stubEnv("NODE_ENV", "test");
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    });

    it("returns 401 when unauthenticated even in development", async () => {
        vi.stubEnv("NODE_ENV", "development");
        getUserMock.mockResolvedValue({ data: { user: null }, error: null });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/recruiter/invites", {
            method: "POST",
            body: JSON.stringify(validPayload)
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.code).toBe("UNAUTHORIZED");
        expect(createInviteMock).not.toHaveBeenCalled();
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
        expect(createInviteMock).not.toHaveBeenCalled();
    });

    it("returns 429 when rate limited", async () => {
        consumeRateLimitMock
            .mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 })
            .mockReturnValueOnce({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/recruiter/invites", {
            method: "POST",
            body: JSON.stringify(validPayload)
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(429);
        expect(body.code).toBe("RATE_LIMITED");
        expect(createInviteMock).not.toHaveBeenCalled();
    });

    it("replays the saved response for a duplicate idempotency key", async () => {
        beginIdempotentRequestMock.mockResolvedValue({
            kind: "replay",
            statusCode: 200,
            body: {
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
        expect(createInviteMock).not.toHaveBeenCalled();
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
        expect(body.results).toHaveLength(1);
        expect(body.results[0].email).toBe("candidate@example.com");
        expect(body.results[0].link).toMatch(/^https:\/\/app\.example\.com\/s\//);
        expect(beginIdempotentRequestMock).toHaveBeenCalledWith(expect.objectContaining({
            scope: "recruiter_invites:create",
            actorId: "user-1",
            key: "create-key-1"
        }));
        expect(createInviteMock).toHaveBeenCalledTimes(1);
        expect(completeIdempotentRequestMock).toHaveBeenCalledWith(expect.objectContaining({
            scope: "recruiter_invites:create",
            actorId: "user-1",
            key: "create-key-1",
            statusCode: 200
        }));
    });
});
