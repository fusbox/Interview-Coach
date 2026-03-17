import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { EmailService } from "@/lib/server/services/email-service";
import { Logger } from "@/lib/logger";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/server/api-errors";
import { consumeRateLimit } from "@/lib/server/rate-limit";

const sessionRepo = new SupabaseSessionRepository();

const WINDOW_MS = 5 * 60 * 1000;
const MAX_IP_REQUESTS = 20;
const MAX_USER_REQUESTS = 30;

const InviteSendSchema = z.object({
    recipientEmail: z.string().email().optional(),
    recipientEmails: z.array(z.string().email()).max(50).optional(),
    recipientFirstName: z.string().trim().min(1),
    role: z.string().trim().min(1),
    inviteLink: z.string().url(),
    recruiterName: z.string().trim().min(1),
    recruiterTitle: z.string().trim().optional(),
    recruiterCompany: z.string().trim().optional(),
    recruiterPhone: z.string().trim().optional(),
    recruiterEmail: z.string().email().optional(),
    sessionIds: z.array(z.string().min(1)).max(50).optional()
}).superRefine((value, ctx) => {
    const direct = value.recipientEmail ? [value.recipientEmail] : [];
    const fromArray = value.recipientEmails || [];
    if (direct.length + fromArray.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one recipient email is required" });
    }
});

function requestIp(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    return forwarded?.split(',')[0].trim() || 'unknown';
}

export async function POST(req: NextRequest) {
    const correlationId = crypto.randomUUID();

    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return errorResponse(401, {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
                correlationId,
                retryable: false
            });
        }

        const ipDecision = consumeRateLimit(`invite_send:ip:${requestIp(req)}`, MAX_IP_REQUESTS, WINDOW_MS);
        const userDecision = consumeRateLimit(`invite_send:user:${user.id}`, MAX_USER_REQUESTS, WINDOW_MS);

        if (!ipDecision.allowed || !userDecision.allowed) {
            Logger.warn("[InviteAPI] Rate limit exceeded", {
                correlationId,
                actorId: user.id,
                ip: requestIp(req)
            }, "InviteAPI");

            return errorResponse(429, {
                code: 'RATE_LIMITED',
                message: 'Rate limit exceeded. Please retry later.',
                correlationId,
                retryable: true
            });
        }

        const body = await req.json();
        const parseResult = InviteSendSchema.safeParse(body);
        if (!parseResult.success) {
            return errorResponse(400, {
                code: 'INVALID_REQUEST',
                message: 'Invalid invite payload',
                correlationId,
                retryable: false
            });
        }

        const {
            recipientEmail,
            recipientEmails,
            recipientFirstName,
            role,
            inviteLink,
            recruiterName,
            recruiterTitle,
            recruiterCompany,
            recruiterPhone,
            recruiterEmail,
            sessionIds
        } = parseResult.data;

        const finalRecipientEmails = Array.from(new Set([
            ...(recipientEmails || []),
            ...(recipientEmail ? [recipientEmail] : [])
        ]));

        if (sessionIds && sessionIds.length > 0) {
            for (const sessionId of sessionIds) {
                const session = await sessionRepo.get(sessionId);
                if (!session || session.recruiterId !== user.id) {
                    return errorResponse(403, {
                        code: 'FORBIDDEN',
                        message: 'Session access denied',
                        correlationId,
                        retryable: false
                    });
                }
            }
        }

        Logger.info("[InviteAPI] Triggering candidate invite email", {
            correlationId,
            actorId: user.id,
            recipientCount: finalRecipientEmails.length,
            outcome: 'start'
        }, "InviteAPI");

        const result = await EmailService.sendInviteEmail({
            recipientEmails: finalRecipientEmails,
            recipientFirstName,
            role,
            inviteLink,
            recruiterName,
            recruiterTitle,
            recruiterCompany,
            recruiterPhone,
            recruiterEmail
        });

        if (sessionIds && Array.isArray(sessionIds)) {
            await Promise.all(sessionIds.map(id => sessionRepo.markInvitationSent(id)));
        }

        Logger.info("[InviteAPI] Invite flow completed", {
            correlationId,
            actorId: user.id,
            recipientCount: finalRecipientEmails.length,
            outcome: 'success'
        }, "InviteAPI");

        return NextResponse.json({ success: true, data: result, correlationId });
    } catch (error) {
        Logger.error("[InviteAPI] Failed to trigger invite email", {
            correlationId,
            error
        }, "InviteAPI");
        return errorResponse(500, {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            correlationId,
            retryable: true
        });
    }
}
