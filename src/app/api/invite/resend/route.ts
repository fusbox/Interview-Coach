import { NextRequest, NextResponse } from "next/server";
import { InviteResendRequestSchema } from "@/lib/domain/schemas";
import { createClient } from "@/lib/supabase/server";
import { EmailService } from "@/lib/server/services/email-service";
import { errorResponse } from "@/lib/server/api-errors";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { createServerLogger } from "@/lib/server/server-logger";
import { incrementMetric, observeMetric, recordAuthDenial, recordRateLimitDenial } from "@/lib/server/metrics";
import { resendInviteEmailCommand } from "@/lib/server/application/invites/resend-invite-email";
import { InviteAccessError, InviteInputError } from "@/lib/server/application/invites/errors";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_IP_REQUESTS = 20;
const MAX_USER_REQUESTS = 30;

function requestIp(req: NextRequest): string {
    const forwarded = req.headers.get("x-forwarded-for");
    return forwarded?.split(",")[0].trim() || "unknown";
}

export async function POST(req: NextRequest) {
    const correlationId = crypto.randomUUID();
    const startedAt = Date.now();
    const routeLogger = createServerLogger("InviteAPI", {
        correlationId,
        route: "/api/invite/resend",
        actorType: "recruiter",
        method: req.method,
    });

    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            recordAuthDenial({
                actorType: "recruiter",
                route: "/api/invite/resend",
                reason: "missing_supabase_user",
            });
            incrementMetric("invite_resend_total", { outcome: "unauthorized" });
            observeMetric("invite_resend_duration_ms", Date.now() - startedAt, { outcome: "unauthorized" });
            return errorResponse(401, {
                code: "UNAUTHORIZED",
                message: "Authentication required",
                correlationId,
                retryable: false,
            });
        }

        const ipDecision = await consumeRateLimit(`invite_resend:ip:${requestIp(req)}`, MAX_IP_REQUESTS, WINDOW_MS);
        const userDecision = await consumeRateLimit(`invite_resend:user:${user.id}`, MAX_USER_REQUESTS, WINDOW_MS);

        if (!ipDecision.allowed || !userDecision.allowed) {
            recordRateLimitDenial({
                actorType: "recruiter",
                route: "/api/invite/resend",
                scope: "invite_resend",
            });
            incrementMetric("invite_resend_total", { outcome: "rate_limited" });
            observeMetric("invite_resend_duration_ms", Date.now() - startedAt, { outcome: "rate_limited" });
            return errorResponse(429, {
                code: "RATE_LIMITED",
                message: "Rate limit exceeded. Please retry later.",
                correlationId,
                retryable: true,
            });
        }

        const body = await req.json();
        const parseResult = InviteResendRequestSchema.safeParse(body);

        if (!parseResult.success) {
            incrementMetric("invite_resend_total", { outcome: "invalid_request" });
            observeMetric("invite_resend_duration_ms", Date.now() - startedAt, { outcome: "invalid_request" });
            return errorResponse(400, {
                code: "INVALID_REQUEST",
                message: "Invalid resend payload",
                correlationId,
                retryable: false,
            });
        }

        const {
            sessionId,
            recruiterName,
            recruiterTitle,
            recruiterCompany,
            recruiterPhone,
            recruiterEmail,
        } = parseResult.data;

        routeLogger.info("Triggering invite resend email", {
            actorId: user.id,
            sessionId,
            outcome: "start",
        });

        const { result, candidateEmail } = await resendInviteEmailCommand({
            actorId: user.id,
            sessionId,
            recruiterName,
            recruiterTitle,
            recruiterCompany,
            recruiterPhone,
            recruiterEmail,
            requestUrl: req.url
        }, {
            sendInviteEmail: EmailService.sendInviteEmail.bind(EmailService)
        });

        routeLogger.info("Invite resend completed", {
            actorId: user.id,
            sessionId,
            recipientEmail: candidateEmail,
            outcome: "success",
        });
        incrementMetric("invite_resend_total", { outcome: "success" });
        observeMetric("invite_resend_duration_ms", Date.now() - startedAt, { outcome: "success" });

        return NextResponse.json({ success: true, data: result, correlationId });
    } catch (error) {
        if (error instanceof InviteAccessError) {
            incrementMetric("invite_resend_total", { outcome: "forbidden" });
            observeMetric("invite_resend_duration_ms", Date.now() - startedAt, { outcome: "forbidden" });
            return errorResponse(403, {
                code: "FORBIDDEN",
                message: error.message,
                correlationId,
                retryable: false,
            });
        }
        if (error instanceof InviteInputError) {
            incrementMetric("invite_resend_total", { outcome: "invalid_request" });
            observeMetric("invite_resend_duration_ms", Date.now() - startedAt, { outcome: "invalid_request" });
            return errorResponse(400, {
                code: "INVALID_REQUEST",
                message: error.message,
                correlationId,
                retryable: false,
            });
        }
        routeLogger.error("Failed to resend invite email", {
            error,
            errorCode: "INVITE_RESEND_FAILED",
        });
        incrementMetric("invite_resend_total", { outcome: "error" });
        observeMetric("invite_resend_duration_ms", Date.now() - startedAt, { outcome: "error" });
        return errorResponse(500, {
            code: "INTERNAL_ERROR",
            message: "Internal server error",
            correlationId,
            retryable: true,
        });
    }
}
