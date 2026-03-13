import { Resend } from 'resend';
import { InterviewSession } from '@/lib/domain/types';
import { Logger } from '@/lib/logger';
import { renderSessionDebriefEmail } from '../emails/SessionDebriefEmail';

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
                logoUrl: `${baseUrl}/rangam-logo.webp`,
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

            Logger.info("[EmailService] Email dispatched successfully", { 
                sessionId: session.id, 
                resendResponse: data,
                status: 'Check Resend Dashboard for delivery updates'
            }, "EmailService");

            return data;
        } catch (error) {
            Logger.error("[EmailService] Failed to send email", error, "EmailService");
            throw error;
        }
    }
}
