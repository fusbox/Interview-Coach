import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMetricsSnapshot, resetMetrics } from "@/lib/server/metrics";

const getAuthenticatedRouteUserMock = vi.fn();
const getSessionMock = vi.fn();
const markInvitationSentMock = vi.fn();
const sendInviteEmailMock = vi.fn();

vi.mock("@/lib/server/auth/current-user", () => ({
    getAuthenticatedRouteUser: getAuthenticatedRouteUserMock,
}));

vi.mock("@/lib/server/infrastructure/postgres-session-repository", () => ({
    PostgresSessionRepository: class {
        get = getSessionMock;
        markInvitationSent = markInvitationSentMock;
    },
}));

vi.mock("@/lib/server/services/email-service", () => ({
    EmailService: {
        sendInviteEmail: sendInviteEmailMock,
    },
}));

vi.mock("@/lib/server/rate-limit", () => ({
    consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 })),
}));

describe("POST /api/invite/resend", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMetrics();
        getAuthenticatedRouteUserMock.mockResolvedValue({ id: "user-1", email: "recruiter@example.com" });
        getSessionMock.mockResolvedValue({
            id: "session-1",
            recruiterId: "user-1",
            inviteToken: "invite-token",
            role: "QA Engineer",
            candidate: {
                email: "candidate@example.com",
                firstName: "Cand",
            },
        });
        markInvitationSentMock.mockResolvedValue(undefined);
        sendInviteEmailMock.mockResolvedValue({ id: "email-1" });
    });

    it("returns 400 when the shared resend request schema fails validation", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/invite/resend", {
            method: "POST",
            body: JSON.stringify({ sessionId: "" }),
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.code).toBe("INVALID_REQUEST");
        expect(sendInviteEmailMock).not.toHaveBeenCalled();
    });

    it("returns 200 for a valid resend request", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/invite/resend", {
            method: "POST",
            body: JSON.stringify({
                sessionId: "session-1",
                recruiterName: "Recruiter",
            }),
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(sendInviteEmailMock).toHaveBeenCalledTimes(1);
        expect(markInvitationSentMock).toHaveBeenCalledWith("session-1");
        expect(getMetricsSnapshot().counters).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "invite_resend_total",
                tags: { outcome: "success" },
                value: 1
            })
        ]));
    });
});
