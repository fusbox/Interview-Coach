import { EmailService } from "@/lib/server/services/email-service";
import { getAppOrigin } from "@/lib/server/url/get-app-origin";
import { InviteAccessError, InviteInputError } from "@/lib/server/application/invites/errors";
import type {
    InviteEmailResult,
    ResendInviteEmailInput,
} from "@/lib/server/application/invites/types";

function assertInviteEmailDispatched(result: InviteEmailResult): asserts result is { id: string } {
    if (!result?.id) {
        throw new Error("Invite email provider did not confirm delivery acceptance");
    }
}

export type ResendInviteEmailDependencies = {
    sessionRepository?: {
        get(sessionId: string): Promise<{
            recruiterId?: string;
            inviteToken?: string;
            role?: string;
            candidate?: { email?: string; firstName?: string };
            candidateName?: string;
        } | null>;
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
    getOrigin?: (requestUrl?: string) => string;
};

export async function resendInviteEmailCommand(
    input: ResendInviteEmailInput,
    dependencies: ResendInviteEmailDependencies = {}
) {
    const sessionRepository = dependencies.sessionRepository ?? new (await import("@/lib/server/infrastructure/supabase-session-repository")).SupabaseSessionRepository();
    // Integration handoff note:
    // This command is Flow 2 for outbound email: resending an invite from recruiter dashboard
    // session data. The provider implementation currently resolves to EmailService, which is
    // Resend-backed today. When integrating the company's established enterprise mail service,
    // preserve this command surface and replace the provider wiring underneath it.
    const sendInviteEmail = dependencies.sendInviteEmail ?? EmailService.sendInviteEmail.bind(EmailService);
    const getOrigin = dependencies.getOrigin ?? getAppOrigin;

    const session = await sessionRepository.get(input.sessionId);

    if (!session || session.recruiterId !== input.actorId) {
        throw new InviteAccessError("Session access denied");
    }

    if (!session.inviteToken) {
        throw new InviteInputError("Session does not have an invite token");
    }

    const candidateEmail = session.candidate?.email;
    const recipientFirstName = session.candidate?.firstName || session.candidateName || "Candidate";

    if (!candidateEmail) {
        throw new InviteInputError("Session does not have a candidate email");
    }

    const inviteLink = `${getOrigin(input.requestUrl)}/s/${session.inviteToken}`;

    const result = await sendInviteEmail({
        recipientEmails: [candidateEmail],
        recipientFirstName,
        role: session.role || "",
        inviteLink,
        recruiterName: input.recruiterName,
        recruiterTitle: input.recruiterTitle,
        recruiterCompany: input.recruiterCompany,
        recruiterPhone: input.recruiterPhone,
        recruiterEmail: input.recruiterEmail
    });
    assertInviteEmailDispatched(result);

    await sessionRepository.markInvitationSent(input.sessionId);

    return {
        result,
        session,
        inviteLink,
        candidateEmail
    };
}
