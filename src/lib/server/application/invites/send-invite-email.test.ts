import { describe, expect, it, vi } from "vitest";
import { sendInviteEmailCommand } from "@/lib/server/application/invites/send-invite-email";
import { InviteAccessError } from "@/lib/server/application/invites/errors";

describe("sendInviteEmailCommand", () => {
    it("throws when any session is not owned by the actor", async () => {
        const getMock = vi.fn()
            .mockResolvedValueOnce({ id: "s1", recruiterId: "user-1" })
            .mockResolvedValueOnce({ id: "s2", recruiterId: "user-2" });

        await expect(() =>
            sendInviteEmailCommand({
                actorId: "user-1",
                recipientEmails: ["candidate@example.com"],
                recipientFirstName: "Cand",
                role: "QA Engineer",
                inviteLink: "https://example.com/s/abc",
                recruiterName: "Recruiter",
                sessionIds: ["s1", "s2"]
            }, {
                sessionRepository: {
                    get: getMock,
                    markInvitationSent: vi.fn()
                } as never,
                sendInviteEmail: vi.fn()
            })
        ).rejects.toBeInstanceOf(InviteAccessError);
    });

    it("sends the email and marks linked sessions as sent", async () => {
        const sendInviteEmail = vi.fn().mockResolvedValue({ id: "email-1" });
        const markInvitationSent = vi.fn().mockResolvedValue(undefined);

        const result = await sendInviteEmailCommand({
            actorId: "user-1",
            recipientEmails: ["candidate@example.com"],
            recipientFirstName: "Cand",
            role: "QA Engineer",
            inviteLink: "https://example.com/s/abc",
            recruiterName: "Recruiter",
            sessionIds: ["s1"]
        }, {
            sessionRepository: {
                get: vi.fn().mockResolvedValue({ id: "s1", recruiterId: "user-1" }),
                markInvitationSent
            } as never,
            sendInviteEmail
        });

        expect(result).toEqual({ id: "email-1" });
        expect(sendInviteEmail).toHaveBeenCalledWith(expect.objectContaining({
            recipientEmails: ["candidate@example.com"],
            recipientFirstName: "Cand",
            role: "QA Engineer"
        }));
        expect(markInvitationSent).toHaveBeenCalledWith("s1");
    });
});
