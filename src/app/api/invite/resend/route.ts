import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { EmailService } from "@/lib/server/services/email-service";
import { errorResponse } from "@/lib/server/api-errors";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { createServerLogger } from "@/lib/server/server-logger";
import { incrementMetric, observeMetric, recordAuthDenial, recordRateLimitDenial } from "@/lib/server/metrics";

const sessionRepo = new SupabaseSessionRepository();

const WINDOW_MS = 5 * 60 * 1000;
const MAX_IP_REQUESTS = 20;
const MAX_USER_REQUESTS = 30;

const InviteResendSchema = z.object({
    sessionId: z.string().min(1),
    recruiterName: z.string().trim().min(1),
    recruiterTitle: z.string().trim().optional(),
    recruiterCompany: z.string().trim().optional(),
    recruiterPhone: z.string().trim().optional(),
    recruiterEmail: z.string().email().optional(),
});

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
            incrementMetric("invite_send_total", { outcome: "unauthorized" });
            observeMetric("invite_send_duration_ms", Date.now() - startedAt, { outcome: "unauthorized" });
            return errorResponse(401, {
                code: "UNAUTHORIZED",
                message: "Authentication required",
                correlationId,
                retryable: false,
            });
        }

        const ipDecision = consumeRateLimit(`invite_resend:ip:${requestIp(req)}`, MAX_IP_REQUESTS, WINDOW_MS);
        const userDecision = consumeRateLimit(`invite_resend:user:${user.id}`, MAX_USER_REQUESTS, WINDOW_MS);

        if (!ipDecision.allowed || !userDecision.allowed) {
            recordRateLimitDenial({
                actorType: "recruiter",
                route: "/api/invite/resend",
                scope: "invite_resend",
            });
            incrementMetric("invite_send_total", { outcome: "rate_limited" });
            observeMetric("invite_send_duration_ms", Date.now() - startedAt, { outcome: "rate_limited" });
            return errorResponse(429, {
                code: "RATE_LIMITED",
                message: "Rate limit exceeded. Please retry later.",
                correlationId,
                retryable: true,
            });
        }

        const body = await req.json();
        const parseResult = InviteResendSchema.safeParse(body);

        if (!parseResult.success) {
            incrementMetric("invite_send_total", { outcome: "invalid_request" });
            observeMetric("invite_send_duration_ms", Date.now() - startedAt, { outcome: "invalid_request" });
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

        const session = await sessionRepo.get(sessionId);

        if (!session || session.recruiterId !== user.id) {
            incrementMetric("invite_send_total", { outcome: "forbidden" });
            observeMetric("invite_send_duration_ms", Date.now() - startedAt, { outcome: "forbidden" });
            return errorResponse(403, {
                code: "FORBIDDEN",
                message: "Session access denied",
                correlationId,
                retryable: false,
            });
        }

        if (!session.inviteToken) {
            incrementMetric("invite_send_total", { outcome: "invalid_request" });
            observeMetric("invite_send_duration_ms", Date.now() - startedAt, { outcome: "invalid_request" });
            return errorResponse(400, {
                code: "INVALID_REQUEST",
                message: "Session does not have an invite token",
                correlationId,
                retryable: false,
            });
        }

        const candidateEmail = session.candidate?.email;
        const recipientFirstName = session.candidate?.firstName || session.candidateName || "Candidate";

        if (!candidateEmail) {
            incrementMetric("invite_send_total", { outcome: "invalid_request" });
            observeMetric("invite_send_duration_ms", Date.now() - startedAt, { outcome: "invalid_request" });
            return errorResponse(400, {
                code: "INVALID_REQUEST",
                message: "Session does not have a candidate email",
                correlationId,
                retryable: false,
            });
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://coach.rangam.com";
        const inviteLink = `${baseUrl}/s/${session.inviteToken}`;

        routeLogger.info("Triggering invite resend email", {
            actorId: user.id,
            sessionId,
            recipientEmail: candidateEmail,
            outcome: "start",
        });

        const result = await EmailService.sendInviteEmail({
            recipientEmails: [candidateEmail],
            recipientFirstName,
            role: session.role,
            inviteLink,
            recruiterName,
            recruiterTitle,
            recruiterCompany,
            recruiterPhone,
            recruiterEmail,
        });

        await sessionRepo.markInvitationSent(sessionId);

        routeLogger.info("Invite resend completed", {
            actorId: user.id,
            sessionId,
            recipientEmail: candidateEmail,
            outcome: "success",
        });
        incrementMetric("invite_send_total", { outcome: "success" });
        observeMetric("invite_send_duration_ms", Date.now() - startedAt, { outcome: "success" });

        return NextResponse.json({ success: true, data: result, correlationId });
    } catch (error) {
        routeLogger.error("Failed to resend invite email", {
            error,
            errorCode: "INVITE_RESEND_FAILED",
        });
        incrementMetric("invite_send_total", { outcome: "error" });
        observeMetric("invite_send_duration_ms", Date.now() - startedAt, { outcome: "error" });
        return errorResponse(500, {
            code: "INTERNAL_ERROR",
            message: "Internal server error",
            correlationId,
            retryable: true,
        });
    }
}
