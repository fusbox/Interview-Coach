import { EmailService } from "@/lib/server/services/email-service";
import { getAppOrigin } from "@/lib/server/url/get-app-origin";
import { InviteAccessError, InviteInputError } from "@/lib/server/application/invites/errors";
import type {
    InviteEmailResult,
    ResendInviteEmailInput,
} from "@/lib/server/application/invites/types";

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

    await sessionRepository.markInvitationSent(input.sessionId);

    return {
        result,
        session,
        inviteLink,
        candidateEmail
    };
}
