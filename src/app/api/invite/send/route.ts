import { NextRequest, NextResponse } from "next/server";
import { InviteSendRequestSchema } from "@/lib/domain/schemas";
import { EmailService } from "@/lib/server/services/email-service";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/server/api-errors";
import { incrementMetric, observeMetric, recordAuthDenial, recordRateLimitDenial } from "@/lib/server/metrics";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { createServerLogger } from "@/lib/server/server-logger";
import { sendInviteEmailCommand } from "@/lib/server/application/invites/send-invite-email";
import { InviteAccessError } from "@/lib/server/application/invites/errors";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_IP_REQUESTS = 20;
const MAX_USER_REQUESTS = 30;

function requestIp(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    return forwarded?.split(',')[0].trim() || 'unknown';
}

export async function POST(req: NextRequest) {
    const correlationId = crypto.randomUUID();
    const startedAt = Date.now();
    const routeLogger = createServerLogger("InviteAPI", {
        correlationId,
        route: "/api/invite/send",
        actorType: "recruiter",
        method: req.method
    });

    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            recordAuthDenial({
                actorType: "recruiter",
                route: "/api/invite/send",
                reason: "missing_supabase_user"
            });
            incrementMetric("invite_send_total", { outcome: "unauthorized" });
            observeMetric("invite_send_duration_ms", Date.now() - startedAt, { outcome: "unauthorized" });
            return errorResponse(401, {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
                correlationId,
                retryable: false
            });
        }

        const ipDecision = await consumeRateLimit(`invite_send:ip:${requestIp(req)}`, MAX_IP_REQUESTS, WINDOW_MS);
        const userDecision = await consumeRateLimit(`invite_send:user:${user.id}`, MAX_USER_REQUESTS, WINDOW_MS);

        if (!ipDecision.allowed || !userDecision.allowed) {
            recordRateLimitDenial({
                actorType: "recruiter",
                route: "/api/invite/send",
                scope: "invite_send"
            });
            routeLogger.warn("Rate limit exceeded", {
                actorId: user.id,
                ip: requestIp(req),
                errorCode: "RATE_LIMITED"
            });
            incrementMetric("invite_send_total", { outcome: "rate_limited" });
            observeMetric("invite_send_duration_ms", Date.now() - startedAt, { outcome: "rate_limited" });

            return errorResponse(429, {
                code: 'RATE_LIMITED',
                message: 'Rate limit exceeded. Please retry later.',
                correlationId,
                retryable: true
            });
        }

        const body = await req.json();
        const parseResult = InviteSendRequestSchema.safeParse(body);
        if (!parseResult.success) {
            incrementMetric("invite_send_total", { outcome: "invalid_request" });
            observeMetric("invite_send_duration_ms", Date.now() - startedAt, { outcome: "invalid_request" });
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

        routeLogger.info("Triggering candidate invite email", {
            actorId: user.id,
            recipientCount: finalRecipientEmails.length,
            outcome: 'start'
        });

        const result = await sendInviteEmailCommand({
            actorId: user.id,
            recipientEmails: finalRecipientEmails,
            recipientFirstName,
            role,
            inviteLink,
            recruiterName,
            recruiterTitle,
            recruiterCompany,
            recruiterPhone,
            recruiterEmail,
            sessionIds
        }, {
            sendInviteEmail: EmailService.sendInviteEmail.bind(EmailService)
        });

        routeLogger.info("Invite flow completed", {
            actorId: user.id,
            recipientCount: finalRecipientEmails.length,
            outcome: 'success'
        });
        incrementMetric("invite_send_total", { outcome: "success" });
        observeMetric("invite_send_duration_ms", Date.now() - startedAt, { outcome: "success" });

        return NextResponse.json({ success: true, data: result, correlationId });
    } catch (error) {
        if (error instanceof InviteAccessError) {
            incrementMetric("invite_send_total", { outcome: "forbidden" });
            observeMetric("invite_send_duration_ms", Date.now() - startedAt, { outcome: "forbidden" });
            return errorResponse(403, {
                code: 'FORBIDDEN',
                message: error.message,
                correlationId,
                retryable: false
            });
        }
        routeLogger.error("Failed to trigger invite email", {
            error,
            errorCode: "INVITE_SEND_FAILED"
        });
        incrementMetric("invite_send_total", { outcome: "error" });
        observeMetric("invite_send_duration_ms", Date.now() - startedAt, { outcome: "error" });
        return errorResponse(500, {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            correlationId,
            retryable: true
        });
    }
}
