import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMetricsSnapshot, resetMetrics } from "@/lib/server/metrics";

const {
    getUserMock,
    sendInviteEmailMock,
    consumeRateLimitMock,
    repositoryState,
    resetRepositoryState,
} = vi.hoisted(() => {
    type SessionRecord = {
        id: string;
        recruiterId?: string;
        inviteToken?: string;
        role?: string;
        candidate?: { email?: string; firstName?: string };
        candidateName?: string;
        invitationSentAt?: number;
    };

    const repositoryState = {
        sessions: new Map<string, SessionRecord>(),
    };

    return {
        getUserMock: vi.fn(),
        sendInviteEmailMock: vi.fn(),
        consumeRateLimitMock: vi.fn(),
        repositoryState,
        resetRepositoryState: () => {
            repositoryState.sessions.clear();
        },
    };
});

vi.mock("@/lib/supabase/server", () => ({
    createClient: () => ({
        auth: {
            getUser: getUserMock,
        },
    }),
}));

vi.mock("@/lib/server/services/email-service", () => ({
    EmailService: {
        sendInviteEmail: sendInviteEmailMock,
    },
}));

vi.mock("@/lib/server/rate-limit", () => ({
    consumeRateLimit: consumeRateLimitMock,
}));

vi.mock("@/lib/server/infrastructure/supabase-session-repository", () => ({
    SupabaseSessionRepository: class {
        async get(sessionId: string) {
            const session = repositoryState.sessions.get(sessionId);
            return session ? structuredClone(session) : null;
        }

        async markInvitationSent(sessionId: string) {
            const session = repositoryState.sessions.get(sessionId);
            if (!session) {
                throw new Error(`Missing session ${sessionId}`);
            }

            session.invitationSentAt = 2222;
        }
    },
}));

describe("POST /api/invite/resend integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMetrics();
        resetRepositoryState();
        getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        sendInviteEmailMock.mockResolvedValue({ id: "email-1" });
        consumeRateLimitMock.mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
        vi.stubEnv("NODE_ENV", "test");
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
        vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    });

    it("uses the actual route and resend command to send, mark, and metricize a resend", async () => {
        repositoryState.sessions.set("session-1", {
            id: "session-1",
            recruiterId: "user-1",
            inviteToken: "invite-token-1",
            role: "QA Engineer",
            candidate: {
                email: "candidate@example.com",
                firstName: "Cand",
            },
            candidateName: "Cand Date",
        });

        const { POST } = await import("./route");

        const response = await POST(new Request("https://app.example.com/api/invite/resend", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-forwarded-for": "127.0.0.1",
            },
            body: JSON.stringify({
                sessionId: "session-1",
                recruiterName: "Recruiter",
                recruiterTitle: "Lead Recruiter",
                recruiterCompany: "Ready2Work",
            }),
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual(expect.objectContaining({
            success: true,
            correlationId: expect.any(String),
        }));
        expect(sendInviteEmailMock).toHaveBeenCalledWith(expect.objectContaining({
            recipientEmails: ["candidate@example.com"],
            recipientFirstName: "Cand",
            role: "QA Engineer",
            inviteLink: "https://app.example.com/s/invite-token-1",
            recruiterName: "Recruiter",
            recruiterTitle: "Lead Recruiter",
            recruiterCompany: "Ready2Work",
        }));
        expect(repositoryState.sessions.get("session-1")?.invitationSentAt).toBe(2222);
        expect(getMetricsSnapshot().counters).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "invite_resend_total",
                tags: { outcome: "success" },
                value: 1,
            }),
        ]));
        expect(getMetricsSnapshot().timings).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "invite_resend_duration_ms",
                tags: { outcome: "success" },
                count: 1,
            }),
        ]));
    });

    it("maps command-level input problems to a 400 and records invalid-request resend metrics", async () => {
        repositoryState.sessions.set("session-2", {
            id: "session-2",
            recruiterId: "user-1",
            inviteToken: "invite-token-2",
            role: "QA Engineer",
            candidate: {
                firstName: "Pat",
            },
            candidateName: "Pat Lee",
        });

        const { POST } = await import("./route");

        const response = await POST(new Request("https://app.example.com/api/invite/resend", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-forwarded-for": "127.0.0.1",
            },
            body: JSON.stringify({
                sessionId: "session-2",
                recruiterName: "Recruiter",
            }),
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual(expect.objectContaining({
            code: "INVALID_REQUEST",
            message: "Session does not have a candidate email",
        }));
        expect(sendInviteEmailMock).not.toHaveBeenCalled();
        expect(getMetricsSnapshot().counters).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "invite_resend_total",
                tags: { outcome: "invalid_request" },
                value: 1,
            }),
        ]));
    });
});
