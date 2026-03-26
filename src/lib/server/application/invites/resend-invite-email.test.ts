import { describe, expect, it, vi } from "vitest";
import { resendInviteEmailCommand } from "@/lib/server/application/invites/resend-invite-email";
import { InviteAccessError, InviteInputError } from "@/lib/server/application/invites/errors";

describe("resendInviteEmailCommand", () => {
    it("throws when the session is not owned by the actor", async () => {
        await expect(() =>
            resendInviteEmailCommand({
                actorId: "user-1",
                sessionId: "session-1",
                recruiterName: "Recruiter",
                requestUrl: "https://example.com/api/invite/resend"
            }, {
                sessionRepository: {
                    get: vi.fn().mockResolvedValue({ id: "session-1", recruiterId: "user-2" }),
                    markInvitationSent: vi.fn()
                } as never,
                sendInviteEmail: vi.fn()
            })
        ).rejects.toBeInstanceOf(InviteAccessError);
    });

    it("throws when the session lacks a candidate email", async () => {
        await expect(() =>
            resendInviteEmailCommand({
                actorId: "user-1",
                sessionId: "session-1",
                recruiterName: "Recruiter",
                requestUrl: "https://example.com/api/invite/resend"
            }, {
                sessionRepository: {
                    get: vi.fn().mockResolvedValue({
                        id: "session-1",
                        recruiterId: "user-1",
                        inviteToken: "token-1",
                        role: "QA Engineer",
                        candidate: {}
                    }),
                    markInvitationSent: vi.fn()
                } as never,
                sendInviteEmail: vi.fn()
            })
        ).rejects.toBeInstanceOf(InviteInputError);
    });

    it("sends the email and marks the session as sent", async () => {
        const sendInviteEmail = vi.fn().mockResolvedValue({ id: "email-1" });
        const markInvitationSent = vi.fn().mockResolvedValue(undefined);

        const result = await resendInviteEmailCommand({
            actorId: "user-1",
            sessionId: "session-1",
            recruiterName: "Recruiter",
            requestUrl: "https://example.com/api/invite/resend"
        }, {
            sessionRepository: {
                get: vi.fn().mockResolvedValue({
                    id: "session-1",
                    recruiterId: "user-1",
                    inviteToken: "token-1",
                    role: "QA Engineer",
                    candidate: {
                        email: "candidate@example.com",
                        firstName: "Cand"
                    }
                }),
                markInvitationSent
            } as never,
            sendInviteEmail,
            getOrigin: vi.fn().mockReturnValue("https://example.com")
        });

        expect(result.result).toEqual({ id: "email-1" });
        expect(result.inviteLink).toBe("https://example.com/s/token-1");
        expect(result.candidateEmail).toBe("candidate@example.com");
        expect(sendInviteEmail).toHaveBeenCalledWith(expect.objectContaining({
            recipientEmails: ["candidate@example.com"],
            recipientFirstName: "Cand",
            role: "QA Engineer",
            inviteLink: "https://example.com/s/token-1"
        }));
        expect(markInvitationSent).toHaveBeenCalledWith("session-1");
    });
});
