import { EmailService } from "@/lib/server/services/email-service";
import { InviteAccessError } from "@/lib/server/application/invites/errors";
import type {
    InviteEmailResult,
    SendInviteEmailInput,
} from "@/lib/server/application/invites/types";

function assertInviteEmailDispatched(result: InviteEmailResult): asserts result is { id: string } {
    if (!result?.id) {
        throw new Error("Invite email provider did not confirm delivery acceptance");
    }
}

export type SendInviteEmailDependencies = {
    sessionRepository?: {
        get(sessionId: string): Promise<{ recruiterId?: string } | null>;
        markInvitationSent(sessionId: string): Promise<void>;
    };
    sendInviteEmail?: (input: {
        recipientEmails: string[];
        recipientFirstName: string;
        role: string;
        inviteLink: string;
        recruiterName: string;
        recruiterTitle?: string;
        recruiterCompany?: string;
        recruiterPhone?: string;
        recruiterEmail?: string;
    }) => Promise<InviteEmailResult>;
};

export async function sendInviteEmailCommand(
    input: SendInviteEmailInput,
    dependencies: SendInviteEmailDependencies = {}
) {
    const sessionRepository = dependencies.sessionRepository ?? new (await import("@/lib/server/infrastructure/supabase-session-repository")).SupabaseSessionRepository();
    // Integration handoff note:
    // This command is Flow 1 for outbound email: the recruiter create-invite experience sending
    // the initial invite. The provider implementation currently resolves to EmailService, which
    // is Resend-backed today. When the deployment environment is wired to the company's standard
    // enterprise mail service, keep this command contract intact and swap the provider behind it.
    const sendInviteEmail = dependencies.sendInviteEmail ?? EmailService.sendInviteEmail.bind(EmailService);

    if (input.sessionIds && input.sessionIds.length > 0) {
        for (const sessionId of input.sessionIds) {
            const session = await sessionRepository.get(sessionId);
            if (!session || session.recruiterId !== input.actorId) {
                throw new InviteAccessError("Session access denied");
            }
        }
    }

    const result = await sendInviteEmail({
        recipientEmails: input.recipientEmails,
        recipientFirstName: input.recipientFirstName,
        role: input.role,
        inviteLink: input.inviteLink,
        recruiterName: input.recruiterName,
        recruiterTitle: input.recruiterTitle,
        recruiterCompany: input.recruiterCompany,
        recruiterPhone: input.recruiterPhone,
        recruiterEmail: input.recruiterEmail
    });
    assertInviteEmailDispatched(result);

    if (input.sessionIds && input.sessionIds.length > 0) {
        await Promise.all(input.sessionIds.map((sessionId) => sessionRepository.markInvitationSent(sessionId)));
    }

    return result;
}
