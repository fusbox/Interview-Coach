import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
    getAuthenticatedRouteUserMock,
    consumeRateLimitMock,
    beginIdempotentRequestMock,
    completeIdempotentRequestMock,
    releaseIdempotentRequestMock,
    createInviteBatchMock,
    createInviteRepositoryMock,
    durableSnapshotMock,
    durableSloSummaryMock,
} = vi.hoisted(() => ({
    getAuthenticatedRouteUserMock: vi.fn(),
    consumeRateLimitMock: vi.fn(),
    beginIdempotentRequestMock: vi.fn(),
    completeIdempotentRequestMock: vi.fn(),
    releaseIdempotentRequestMock: vi.fn(),
    createInviteBatchMock: vi.fn(),
    createInviteRepositoryMock: vi.fn(),
    durableSnapshotMock: vi.fn(),
    durableSloSummaryMock: vi.fn(),
}));

vi.mock("@/lib/server/auth/current-user", () => ({
    getAuthenticatedRouteUser: getAuthenticatedRouteUserMock,
}));

vi.mock("@/lib/server/rate-limit", () => ({
    consumeRateLimit: consumeRateLimitMock,
}));

vi.mock("@/lib/server/idempotency", () => ({
    beginIdempotentRequest: beginIdempotentRequestMock,
    completeIdempotentRequest: completeIdempotentRequestMock,
    releaseIdempotentRequest: releaseIdempotentRequestMock,
}));

vi.mock("@/lib/server/application/invites/create-invite-batch", () => ({
    createInviteBatch: createInviteBatchMock,
}));

vi.mock("@/lib/server/infrastructure/invite-repository", () => ({
    createInviteRepository: createInviteRepositoryMock,
}));

vi.mock("@/lib/server/metrics/backend", async () => {
    const actual = await vi.importActual<typeof import("@/lib/server/metrics/backend")>("@/lib/server/metrics/backend");

    return {
        ...actual,
        getDurableMetricsBackend: () => ({
            readSnapshot: durableSnapshotMock,
            readSloSummary: durableSloSummaryMock,
            writeCounter: vi.fn().mockResolvedValue(undefined),
            writeTiming: vi.fn().mockResolvedValue(undefined),
        }),
        getMetricsBackendName: () => "postgres" as const,
    };
});

vi.mock("@/lib/logger", () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

const originalEnv = { ...process.env };

describe("production contract integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env = { ...originalEnv };

        getAuthenticatedRouteUserMock.mockResolvedValue({ id: "user-1", email: "recruiter@example.com" });
        consumeRateLimitMock.mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
        beginIdempotentRequestMock.mockResolvedValue({ kind: "acquired" });
        completeIdempotentRequestMock.mockResolvedValue(undefined);
        releaseIdempotentRequestMock.mockResolvedValue(undefined);
        createInviteRepositoryMock.mockResolvedValue({ kind: "invite-repository" });
        createInviteBatchMock.mockResolvedValue({
            batchId: "batch-1",
            results: [{
                status: "created",
                id: "session-1",
                firstName: "Cand",
                lastName: "Date",
                email: "candidate@example.com",
                link: "https://base.example.com/s/token-1",
            }],
            failures: [],
            summary: {
                requested: 1,
                succeeded: 1,
                failed: 0,
                hasFailures: false,
            },
        });
        durableSnapshotMock.mockResolvedValue({
            generatedAt: "2026-03-29T12:00:00.000Z",
            counters: [{
                name: "invite_send_total",
                tags: { outcome: "success" },
                value: 1,
            }],
            timings: [],
        });
        durableSloSummaryMock.mockResolvedValue({
            generatedAt: "2026-03-29T12:00:00.000Z",
            since: "2026-03-28T12:00:00.000Z",
            sessionStart: {
                successCount: 1,
                failureCount: 0,
                totalCount: 1,
                successRate: 100,
            },
            sessionProgress: {
                successCount: 0,
                replaySuccessCount: 0,
                errorCount: 0,
                requestInProgressCount: 0,
                idempotencyMismatchCount: 0,
                invalidRequestCount: 0,
                sliNumerator: 0,
                sliDenominator: 0,
                successRate: 0,
            },
            aiReliability: {
                overall: {
                    successCount: 0,
                    errorCount: 0,
                    malformedResponseCount: 0,
                    mockFallbackCount: 0,
                    totalCount: 0,
                    successRate: 0,
                },
                operations: [],
            },
            aiLatency: {
                operations: [],
            },
        });
        vi.stubEnv("ENCRYPTION_SECRET", "0123456789abcdef0123456789abcdef");
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        vi.unstubAllEnvs();
    });

    it("fails recruiter invite creation in production when no configured public origin is set", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("METRICS_BACKEND", "postgres");
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
        vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");

        const { POST } = await import("@/app/api/recruiter/invites/route");

        const response = await POST(new Request("https://untrusted.example.com/api/recruiter/invites", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "idempotency-key": "invite-key-1",
                "x-forwarded-for": "127.0.0.1",
            },
            body: JSON.stringify({
                role: "QA Engineer",
                jobDescription: "Own API quality",
                candidates: [{
                    firstName: "Cand",
                    lastName: "Date",
                    email: "candidate@example.com",
                    reqId: "REQ-1",
                }],
                questions: [{
                    text: "Tell me about a bug you found.",
                    category: "STAR",
                    index: 0,
                }],
            }),
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual(expect.objectContaining({
            code: "INTERNAL_ERROR",
            message: "Internal server error",
        }));
        expect(createInviteBatchMock).not.toHaveBeenCalled();
    });

    it("accepts NEXT_PUBLIC_BASE_URL as the production public origin contract through the invite route", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("METRICS_BACKEND", "postgres");
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
        vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://base.example.com");

        const { POST } = await import("@/app/api/recruiter/invites/route");

        const response = await POST(new Request("https://untrusted.example.com/api/recruiter/invites", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "idempotency-key": "invite-key-2",
                "x-forwarded-for": "127.0.0.1",
            },
            body: JSON.stringify({
                role: "QA Engineer",
                jobDescription: "Own API quality",
                candidates: [{
                    firstName: "Cand",
                    lastName: "Date",
                    email: "candidate@example.com",
                    reqId: "REQ-1",
                }],
                questions: [{
                    text: "Tell me about a bug you found.",
                    category: "STAR",
                    index: 0,
                }],
            }),
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.batchId).toBe("batch-1");
        expect(createInviteBatchMock).toHaveBeenCalledWith(expect.objectContaining({
            appBaseUrl: "https://base.example.com",
        }), expect.any(Object));
    });

    it("surfaces durable ops metrics in production when the metrics backend contract is satisfied", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("METRICS_BACKEND", "postgres");

        const { GET } = await import("@/app/api/recruiter/ops/metrics/route");

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.snapshot.counters).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "invite_send_total",
                tags: { outcome: "success" },
                value: 1,
            }),
        ]));
        expect(body.sloSummary.sessionStart).toMatchObject({
            successCount: 1,
            failureCount: 0,
            totalCount: 1,
            successRate: 100,
        });
    });
});
