import nodemailer from 'nodemailer';
import { SmtpEmailSendResultSchema } from '@/lib/domain/schemas';
import { InterviewSession } from '@/lib/domain/types';
import { Logger } from '@/lib/logger';
import { renderSessionDebriefEmail } from '../emails/SessionDebriefEmail';
import { renderCandidateInviteEmail } from '../emails/CandidateInviteEmail';
import { parseProviderValue } from '@/lib/server/provider-response';
import { pilotRollout } from '@/lib/config/pilot-rollout';
import { assertProductionServerEnv, getOptionalServerEnv } from '@/lib/server/config/server-env';
import { getAppOrigin } from '@/lib/server/url/get-app-origin';
import { ProviderResponseError } from '@/lib/server/provider-errors';

const DEFAULT_SMTP_HOST = "email-smtp.us-east-1.amazonaws.com";
const DEFAULT_SMTP_PORT = 587;
const DEFAULT_FROM_EMAIL = "Rangam Interview Coach <interviews@coach.rangam.com>";
const SMTP_PROVIDER = "smtp";

assertProductionServerEnv(["SMTP_USERNAME", "SMTP_PASSWORD"], "email delivery configuration");

type SmtpSendResult = {
    messageId: string;
    accepted?: string[];
    rejected?: string[];
    pending?: string[];
    response?: string;
};

/**
 * Integration handoff note:
 * This service is the provider-specific adapter for outbound email and is intentionally isolated
 * so the invite/debrief application flows do not need to change when infrastructure changes.
 *
 * Known business flows that depend on this adapter:
 * 1. Recruiter create-invite flow sending initial invite emails.
 * 2. Recruiter dashboard resend flow sending invite emails from existing session data.
 * 3. Candidate post-session debrief autosend on session completion.
 *
 * Keep the command-layer contracts stable so the rest of the app does not need to change.
 */
export class EmailService {
    /**
     * Provider adapter helper.
     * This app now uses the company's SMTP relay for outbound email. Keep this adapter as the
     * single integration seam so invite and debrief flows stay stable if the provider changes.
     */
    private static getClient() {
        const username = getOptionalServerEnv("SMTP_USERNAME");
        const password = getOptionalServerEnv("SMTP_PASSWORD");

        if (!username || !password) {
            return null;
        }

        const host = getOptionalServerEnv("SMTP_HOST") || DEFAULT_SMTP_HOST;
        const configuredPort = getOptionalServerEnv("SMTP_PORT");
        const port = configuredPort ? Number.parseInt(configuredPort, 10) : DEFAULT_SMTP_PORT;

        return nodemailer.createTransport({
            host,
            port: Number.isFinite(port) ? port : DEFAULT_SMTP_PORT,
            secure: port === 465,
            requireTLS: port !== 465,
            auth: {
                user: username,
                pass: password,
            },
        });
    }

    private static getFromEmail() {
        return getOptionalServerEnv("SMTP_FROM_EMAIL") || DEFAULT_FROM_EMAIL;
    }

    private static assertSmtpAccepted(result: SmtpSendResult, operation: string) {
        const acceptedCount = result.accepted?.length ?? 0;
        const rejectedCount = result.rejected?.length ?? 0;

        if (acceptedCount === 0 || rejectedCount > 0) {
            throw new ProviderResponseError(
                SMTP_PROVIDER,
                operation,
                "schema_validation",
                "SMTP provider did not accept all recipients"
            );
        }
    }

    static async sendDebriefEmail(session: InterviewSession) {
        // Flow 3: post-session debrief autosend.
        const transport = this.getClient();
        
        if (!transport) {
            Logger.warn("[EmailService] No SMTP credentials found in environment. Skipping email.", {
                sessionId: session.id,
                envKeys: Object.keys(process.env).filter((key) => key.includes("SMTP") || key.includes("RESEND"))
            }, "EmailService");
            return;
        }

        const candidateEmail = session.candidate?.email;
        const candidateName = session.candidate?.firstName || session.candidateName || 'Candidate';

        if (!candidateEmail) {
            Logger.warn("[EmailService] No candidate email found. Skipping email.", { sessionId: session.id }, "EmailService");
            return;
        }

        try {
            const fromEmail = this.getFromEmail();
            
            Logger.info("[EmailService] Preparing to send via SMTP", {
                sessionId: session.id,
                recipient: candidateEmail,
                from: fromEmail
            }, "EmailService");

            const appOrigin = getAppOrigin();
            
            const practiceAgainUrl = `${appOrigin}/s/${session.inviteToken}/practice-again`;

            const html = renderSessionDebriefEmail({
                candidateName,
                role: session.role,
                summaryNarrative: session.summaryNarrative || '',
                practiceAgainUrl,
                logoUrl: `${appOrigin}/TA-logo.png`,
            });

            const sendResult = await transport.sendMail({
                from: fromEmail,
                to: [candidateEmail],
                subject: 'Your Interview Practice Debrief is Ready',
                html,
            });

            const parsedData = parseProviderValue(sendResult, SmtpEmailSendResultSchema, {
                provider: SMTP_PROVIDER,
                operation: "sendDebriefEmail"
            });
            this.assertSmtpAccepted(parsedData, "sendDebriefEmail");

            Logger.info("[EmailService] Email dispatched successfully", {
                sessionId: session.id,
                smtpResponse: parsedData
            }, "EmailService");

            return {
                id: parsedData.messageId,
            };
        } catch (error) {
            Logger.error("[EmailService] Failed to send email", {
                error,
                provider: error instanceof ProviderResponseError ? error.provider : SMTP_PROVIDER,
                operation: error instanceof ProviderResponseError ? error.operation : "sendDebriefEmail",
                providerErrorKind: error instanceof ProviderResponseError ? error.kind : undefined
            }, "EmailService");
            throw error;
        }
    }

    static async sendInviteEmail(params: {
        recipientEmails: string[];
        recipientFirstName: string;
        role: string;
        inviteLink: string;
        recruiterName: string;
        recruiterTitle?: string;
        recruiterCompany?: string;
        recruiterPhone?: string;
        recruiterEmail?: string;
    }) {
        // Flow 1 and Flow 2: recruiter invite send + recruiter resend from dashboard/session data.
        const transport = this.getClient();
        
        if (!transport) {
            Logger.warn("[EmailService] No SMTP credentials found in environment. Skipping invite email.", {
                recipientEmails: params.recipientEmails,
                envKeys: Object.keys(process.env).filter((key) => key.includes("SMTP") || key.includes("RESEND"))
            }, "EmailService");
            return;
        }

        try {
            const fromEmail = this.getFromEmail();
            const appOrigin = getAppOrigin();
            
            const html = renderCandidateInviteEmail({
                firstName: params.recipientFirstName,
                role: params.role,
                inviteLink: params.inviteLink,
                logoUrl: `${appOrigin}/TA-logo.png`,
                recruiterName: params.recruiterName,
                recruiterTitle: params.recruiterTitle,
                recruiterCompany: params.recruiterCompany,
                recruiterPhone: params.recruiterPhone,
                recruiterEmail: params.recruiterEmail,
                pilotEnabled: pilotRollout.enabled,
                supportPhone: pilotRollout.supportPhone,
                supportContactName: pilotRollout.supportName,
                supportContactEmail: pilotRollout.supportEmail,
            });

            Logger.info("[EmailService] Preparing to send invite via SMTP", {
                recipients: params.recipientEmails,
                from: fromEmail,
                role: params.role,
                htmlLength: html.length
            }, "EmailService");

            // Addressing logic
            // 1 recipient -> To
            // >1 recipient -> Bcc, To as Batch placeholder (using recruiter email as valid target)
            // Recruiter -> Cc
            const to = params.recipientEmails.length === 1 
                ? params.recipientEmails 
                : [`Interviews (${params.recipientEmails.length} recipients) <${params.recruiterEmail || 'interviews@coach.rangam.com'}>`];
            const bcc = params.recipientEmails.length > 1 ? params.recipientEmails : [];
            const cc = params.recruiterEmail ? [params.recruiterEmail] : [];

            const sendResult = await transport.sendMail({
                from: fromEmail,
                to,
                cc,
                bcc,
                subject: `Practice Interview Invitation: ${params.role}`,
                html,
            });

            const parsedData = parseProviderValue(sendResult, SmtpEmailSendResultSchema, {
                provider: SMTP_PROVIDER,
                operation: "sendInviteEmail"
            });
            this.assertSmtpAccepted(parsedData, "sendInviteEmail");

            Logger.info("[EmailService] Invite email dispatched", {
                recipientEmails: params.recipientEmails,
                smtpResponse: parsedData
            }, "EmailService");

            return {
                id: parsedData.messageId,
            };
        } catch (error) {
            Logger.error("[EmailService] Failed to send invite email", {
                error,
                provider: error instanceof ProviderResponseError ? error.provider : SMTP_PROVIDER,
                operation: error instanceof ProviderResponseError ? error.operation : "sendInviteEmail",
                providerErrorKind: error instanceof ProviderResponseError ? error.kind : undefined
            }, "EmailService");
            throw error;
        }
    }
}
