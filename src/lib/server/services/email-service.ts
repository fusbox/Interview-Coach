import { Resend } from 'resend';
import { ResendEmailSendResultSchema } from '@/lib/domain/schemas';
import { InterviewSession } from '@/lib/domain/types';
import { Logger } from '@/lib/logger';
import { renderSessionDebriefEmail } from '../emails/SessionDebriefEmail';
import { renderCandidateInviteEmail } from '../emails/CandidateInviteEmail';
import { parseProviderValue } from '@/lib/server/provider-response';
import { pilotRollout } from '@/lib/config/pilot-rollout';
import { assertProductionServerEnv, getOptionalServerEnv } from '@/lib/server/config/server-env';
import { getAppOrigin } from '@/lib/server/url/get-app-origin';
import { ProviderResponseError } from '@/lib/server/provider-errors';

assertProductionServerEnv(["RESEND_API_KEY"], "email delivery configuration");

/**
 * Integration handoff note:
 * This service is the current provider-specific adapter for outbound email and is intentionally
 * implemented with Resend for local/dev rollout. When this app is deployed into the company's
 * managed environments, replace the Resend-specific client/env wiring in this file with the
 * company-approved enterprise email service already established there.
 *
 * Known business flows that depend on this adapter:
 * 1. Recruiter create-invite flow sending initial invite emails.
 * 2. Recruiter dashboard resend flow sending invite emails from existing session data.
 * 3. Candidate post-session debrief autosend on session completion.
 *
 * Keep the command-layer contracts stable when swapping providers so the rest of the app does
 * not need to change. If the deployment environment uses a Microsoft/enterprise mail stack,
 * this file is the place to wire that provider in.
 */
export class EmailService {
    /**
     * Provider adapter helper.
     * Replace this Resend client bootstrap with the deployment environment's established
     * enterprise mail client when the integration team connects the production provider.
     */
    private static getClient() {
        const apiKey = getOptionalServerEnv("RESEND_API_KEY");
        if (!apiKey) {
            return null;
        }
        return new Resend(apiKey);
    }

    static async sendDebriefEmail(session: InterviewSession) {
        // Flow 3: post-session debrief autosend. Preserve this method signature when swapping
        // Resend out for the company's standard outbound email implementation.
        const resend = this.getClient();
        
        if (!resend) {
            Logger.warn("[EmailService] No RESEND_API_KEY found in environment. Skipping email.", { 
                sessionId: session.id,
                envKeys: Object.keys(process.env).filter(k => k.includes('RESEND'))
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
            const fromEmail = getOptionalServerEnv("RESEND_FROM_EMAIL") || 'Rangam Interview Coach <interviews@coach.rangam.com>';
            
            Logger.info("[EmailService] Preparing to send via Resend", { 
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
                logoUrl: `${appOrigin}/rangam-logo.png`,
            });

            const { data, error } = await resend.emails.send({
                from: fromEmail,
                to: [candidateEmail],
                subject: 'Your Interview Practice Debrief is Ready',
                html,
            });

            if (error) {
                Logger.error("[EmailService] Resend API Error Details", { 
                    error, 
                    sessionId: session.id,
                    from: fromEmail,
                    to: candidateEmail 
                }, "EmailService");
                throw error;
            }

            const parsedData = parseProviderValue(data, ResendEmailSendResultSchema, {
                provider: "resend",
                operation: "sendDebriefEmail"
            });

            Logger.info("[EmailService] Email dispatched successfully", { 
                sessionId: session.id, 
                resendResponse: parsedData,
                status: 'Check Resend Dashboard for delivery updates'
            }, "EmailService");

            return parsedData;
        } catch (error) {
            Logger.error("[EmailService] Failed to send email", {
                error,
                provider: error instanceof ProviderResponseError ? error.provider : "resend",
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
        // Flow 1 and Flow 2: recruiter invite send + recruiter resend from dashboard/session
        // data. Keep this contract stable so only this provider adapter has to change during
        // enterprise mail-service integration.
        const resend = this.getClient();
        
        if (!resend) {
            Logger.warn("[EmailService] No RESEND_API_KEY found in environment. Skipping invite email.", { 
                recipientEmails: params.recipientEmails,
                envKeys: Object.keys(process.env).filter(k => k.includes('RESEND'))
            }, "EmailService");
            return;
        }

        try {
            const fromEmail = getOptionalServerEnv("RESEND_FROM_EMAIL") || 'Rangam Interview Coach <interviews@coach.rangam.com>';
            const appOrigin = getAppOrigin();
            
            const html = renderCandidateInviteEmail({
                firstName: params.recipientFirstName,
                role: params.role,
                inviteLink: params.inviteLink,
                logoUrl: `${appOrigin}/rangam-logo.png`,
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

            Logger.info("[EmailService] Preparing to send invite via Resend", { 
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

            const { data, error } = await resend.emails.send({
                from: fromEmail,
                to,
                cc,
                bcc,
                subject: `Practice Interview Invitation: ${params.role}`,
                html,
            });

            if (error) {
                Logger.error("[EmailService] Resend Invite API Error", { 
                    error, 
                    from: fromEmail,
                    to,
                    cc,
                    bcc
                }, "EmailService");
                throw error;
            }

            const parsedData = parseProviderValue(data, ResendEmailSendResultSchema, {
                provider: "resend",
                operation: "sendInviteEmail"
            });

            Logger.info("[EmailService] Invite email dispatched", { 
                recipientEmails: params.recipientEmails,
                resendResponse: parsedData 
            }, "EmailService");

            return parsedData;
        } catch (error) {
            Logger.error("[EmailService] Failed to send invite email", {
                error,
                provider: error instanceof ProviderResponseError ? error.provider : "resend",
                operation: error instanceof ProviderResponseError ? error.operation : "sendInviteEmail",
                providerErrorKind: error instanceof ProviderResponseError ? error.kind : undefined
            }, "EmailService");
            throw error;
        }
    }
}
