import { NextRequest, NextResponse } from "next/server";
import { uuidv7 } from "uuidv7";
import { randomBytes } from "crypto";
import { errorResponse } from "@/lib/server/api-errors";
import {
    beginIdempotentRequest,
    completeIdempotentRequest,
    releaseIdempotentRequest
} from "@/lib/server/idempotency";
import { SupabaseInviteRepository } from "@/lib/server/infrastructure/supabase-invite-repository";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { incrementMetric, observeMetric, recordAuthDenial, recordRateLimitDenial } from "@/lib/server/metrics";
import { createClient } from "@/lib/supabase/server";
import { createServerLogger } from "@/lib/server/server-logger";
import { getAppOrigin } from "@/lib/server/url/get-app-origin";
import { createInviteBatch } from "@/lib/server/application/invites/create-invite-batch";
import { CreateInviteRequestSchema } from "@/lib/domain/schemas";

const repository = new SupabaseInviteRepository();
const IDEMPOTENCY_SCOPE = "recruiter_invites:create";
const WINDOW_MS = 5 * 60 * 1000;
const MAX_IP_REQUESTS = 10;
const MAX_USER_REQUESTS = 20;

function requestIp(req: NextRequest): string {
    const forwarded = req.headers.get("x-forwarded-for");
    return forwarded?.split(",")[0].trim() || "unknown";
}

export async function POST(request: NextRequest) {
    const correlationId = crypto.randomUUID();
    const startedAt = Date.now();
    const routeLogger = createServerLogger("RecruiterInvitesAPI", {
        correlationId,
        route: "/api/recruiter/invites",
        actorType: "recruiter",
        method: request.method
    });
    let idempotencyKey: string | null = null;
    let userId: string | null = null;
    let idempotencyReserved = false;

    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            recordAuthDenial({
                actorType: "recruiter",
                route: "/api/recruiter/invites",
                reason: "missing_supabase_user"
            });
            incrementMetric("recruiter_invite_create_total", { outcome: "unauthorized" });
            observeMetric("recruiter_invite_create_duration_ms", Date.now() - startedAt, { outcome: "unauthorized" });
            return errorResponse(401, {
                code: "UNAUTHORIZED",
                message: "Authentication required",
                correlationId,
                retryable: false
            });
        }

        userId = user.id;

        const rawBody = await request.json();
        const parseResult = CreateInviteRequestSchema.safeParse(rawBody);
        if (!parseResult.success) {
            incrementMetric("recruiter_invite_create_total", { outcome: "invalid_request" });
            observeMetric("recruiter_invite_create_duration_ms", Date.now() - startedAt, { outcome: "invalid_request" });
            return errorResponse(400, {
                code: "INVALID_REQUEST",
                message: "Invalid invite payload",
                correlationId,
                retryable: false
            });
        }

        idempotencyKey = request.headers.get("Idempotency-Key")?.trim() || null;
        if (idempotencyKey) {
            const reservation = await beginIdempotentRequest({
                scope: IDEMPOTENCY_SCOPE,
                actorId: user.id,
                key: idempotencyKey,
                payload: parseResult.data
            });

            if (reservation.kind === "replay") {
                return NextResponse.json(reservation.body, { status: reservation.statusCode });
            }

            if (reservation.kind === "pending") {
                return errorResponse(409, {
                    code: "REQUEST_IN_PROGRESS",
                    message: "An identical invite creation request is already in progress",
                    correlationId,
                    retryable: true
                });
            }

            if (reservation.kind === "conflict") {
                return errorResponse(409, {
                    code: "IDEMPOTENCY_MISMATCH",
                    message: "Idempotency key cannot be reused with a different payload",
                    correlationId,
                    retryable: false
                });
            }

            idempotencyReserved = true;
        }

        const ip = requestIp(request);
        const ipDecision = await consumeRateLimit(`recruiter_invites:ip:${ip}`, MAX_IP_REQUESTS, WINDOW_MS);
        const userDecision = await consumeRateLimit(`recruiter_invites:user:${user.id}`, MAX_USER_REQUESTS, WINDOW_MS);

        if (!ipDecision.allowed || !userDecision.allowed) {
            if (idempotencyReserved && idempotencyKey) {
                await releaseIdempotentRequest({
                    scope: IDEMPOTENCY_SCOPE,
                    actorId: user.id,
                    key: idempotencyKey
                });
                idempotencyReserved = false;
            }

            recordRateLimitDenial({
                actorType: "recruiter",
                route: "/api/recruiter/invites",
                scope: "recruiter_invites"
            });
            routeLogger.warn("Rate limit exceeded", {
                actorId: user.id,
                ip,
                errorCode: "RATE_LIMITED"
            });
            incrementMetric("recruiter_invite_create_total", { outcome: "rate_limited" });
            observeMetric("recruiter_invite_create_duration_ms", Date.now() - startedAt, { outcome: "rate_limited" });

            return errorResponse(429, {
                code: "RATE_LIMITED",
                message: "Rate limit exceeded. Please retry later.",
                correlationId,
                retryable: true
            });
        }

        const { role, jobDescription, candidates, questions } = parseResult.data;
        const appBaseUrl = getAppOrigin(request.url);

        routeLogger.info("Creating invites", {
            actorId: user.id,
            candidateCount: candidates.length,
            outcome: "start"
        });

        const batchResult = await createInviteBatch(
            {
                role,
                jobDescription,
                candidates,
                questions,
                createdBy: user.id,
                appBaseUrl,
            },
            {
                repository,
                createSessionId: () => uuidv7(),
                createToken: () => randomBytes(16).toString("hex"),
            }
        );

        const responseStatus = batchResult.summary.hasFailures ? 207 : 200;
        const responseBody = { ...batchResult, correlationId };

        if (idempotencyReserved && idempotencyKey) {
            await completeIdempotentRequest({
                scope: IDEMPOTENCY_SCOPE,
                actorId: user.id,
                key: idempotencyKey,
                statusCode: responseStatus,
                body: responseBody
            });
        }

        routeLogger.info("Invite creation completed", {
            actorId: user.id,
            candidateCount: candidates.length,
            succeeded: batchResult.summary.succeeded,
            failed: batchResult.summary.failed,
            outcome: batchResult.summary.hasFailures ? "partial_failure" : "success"
        });
        incrementMetric("recruiter_invite_create_total", {
            outcome: batchResult.summary.hasFailures ? "partial_failure" : "success",
        });
        observeMetric("recruiter_invite_create_duration_ms", Date.now() - startedAt, {
            outcome: batchResult.summary.hasFailures ? "partial_failure" : "success",
        });

        return NextResponse.json(responseBody, { status: responseStatus });
    } catch (error) {
        routeLogger.error("Failed to create invites", {
            actorId: userId ?? undefined,
            error,
            errorCode: "RECRUITER_INVITE_CREATE_FAILED"
        });
        incrementMetric("recruiter_invite_create_total", { outcome: "error" });
        observeMetric("recruiter_invite_create_duration_ms", Date.now() - startedAt, { outcome: "error" });

        if (idempotencyReserved && idempotencyKey && userId) {
            await releaseIdempotentRequest({
                scope: IDEMPOTENCY_SCOPE,
                actorId: userId,
                key: idempotencyKey
            });
        }

        return errorResponse(500, {
            code: "INTERNAL_ERROR",
            message: "Internal server error",
            correlationId,
            retryable: true
        });
    }
}
