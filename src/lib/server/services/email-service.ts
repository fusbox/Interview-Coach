import { Resend } from 'resend';
import { ResendEmailSendResultSchema } from '@/lib/domain/schemas';
import { InterviewSession } from '@/lib/domain/types';
import { Logger } from '@/lib/logger';
import { renderSessionDebriefEmail } from '../emails/SessionDebriefEmail';
import { renderCandidateInviteEmail } from '../emails/CandidateInviteEmail';
import { parseProviderValue } from '@/lib/server/provider-response';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://coach.rangam.com';

export class EmailService {
    /**
     * Helper to get a fresh Resend client with the latest API key from process.env
     */
    private static getClient() {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            return null;
        }
        return new Resend(apiKey);
    }

    static async sendDebriefEmail(session: InterviewSession) {
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
            const fromEmail = process.env.RESEND_FROM_EMAIL || 'Rangam Interview Coach <interviews@coach.rangam.com>';
            
            Logger.info("[EmailService] Preparing to send via Resend", { 
                sessionId: session.id, 
                recipient: candidateEmail,
                from: fromEmail
            }, "EmailService");
            
            const debriefUrl = `${baseUrl}/s/${session.inviteToken}`;

            const html = renderSessionDebriefEmail({
                candidateName,
                role: session.role,
                summaryNarrative: session.summaryNarrative || '',
                debriefUrl,
                logoUrl: `${baseUrl}/rangam-logo.png`,
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
            Logger.error("[EmailService] Failed to send email", error, "EmailService");
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
        const resend = this.getClient();
        
        if (!resend) {
            Logger.warn("[EmailService] No RESEND_API_KEY found in environment. Skipping invite email.", { 
                recipientEmails: params.recipientEmails,
                envKeys: Object.keys(process.env).filter(k => k.includes('RESEND'))
            }, "EmailService");
            return;
        }

        try {
            const fromEmail = process.env.RESEND_FROM_EMAIL || 'Rangam Interview Coach <interviews@coach.rangam.com>';
            
            const html = renderCandidateInviteEmail({
                firstName: params.recipientFirstName,
                role: params.role,
                inviteLink: params.inviteLink,
                logoUrl: `${baseUrl}/rangam-logo.png`,
                recruiterName: params.recruiterName,
                recruiterTitle: params.recruiterTitle,
                recruiterCompany: params.recruiterCompany,
                recruiterPhone: params.recruiterPhone,
                recruiterEmail: params.recruiterEmail,
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
                subject: `Interview Invitation: ${params.role}`,
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
            Logger.error("[EmailService] Failed to send invite email", error, "EmailService");
            throw error;
        }
    }
}
