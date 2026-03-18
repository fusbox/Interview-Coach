import { NextRequest, NextResponse } from "next/server";
import { uuidv7 } from "uuidv7";
import { randomBytes } from "crypto";
import { z } from "zod";
import { Invite } from "@/lib/domain/invite";
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

const repository = new SupabaseInviteRepository();
const IDEMPOTENCY_SCOPE = "recruiter_invites:create";
const WINDOW_MS = 5 * 60 * 1000;
const MAX_IP_REQUESTS = 10;
const MAX_USER_REQUESTS = 20;

const CreateInviteSchema = z.object({
    role: z.string().trim().min(1),
    jobDescription: z.string().optional(),
    candidates: z.array(z.object({
        firstName: z.string().trim().min(1),
        lastName: z.string().trim().min(1),
        email: z.string().email(),
        reqId: z.string().trim().min(1),
        resumeText: z.string().optional()
    })).min(1).max(50),
    questions: z.array(z.object({
        text: z.string().trim().min(1),
        category: z.string().trim().min(1),
        index: z.number().int().min(0)
    })).min(1)
});

function requestIp(req: NextRequest): string {
    const forwarded = req.headers.get("x-forwarded-for");
    return forwarded?.split(",")[0].trim() || "unknown";
}

function normalizeAppOrigin(origin: string): string {
    const url = new URL(origin);

    if (url.hostname === "0.0.0.0" || url.hostname === "::" || url.hostname === "[::]") {
        url.hostname = "localhost";
    }

    return url.origin;
}

function baseUrl(req: NextRequest): string {
    const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (configured) {
        return configured;
    }

    return normalizeAppOrigin(new URL(req.url).origin);
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
        const parseResult = CreateInviteSchema.safeParse(rawBody);
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
        const ipDecision = consumeRateLimit(`recruiter_invites:ip:${ip}`, MAX_IP_REQUESTS, WINDOW_MS);
        const userDecision = consumeRateLimit(`recruiter_invites:user:${user.id}`, MAX_USER_REQUESTS, WINDOW_MS);

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
        const results: { id: string; firstName: string; lastName: string; email: string; link: string }[] = [];
        const appBaseUrl = baseUrl(request);

        routeLogger.info("Creating invites", {
            actorId: user.id,
            candidateCount: candidates.length,
            outcome: "start"
        });

        for (const candidate of candidates) {
            const token = randomBytes(16).toString("hex");
            const sessionId = uuidv7();

            const invite: Invite = {
                id: sessionId,
                token,
                role,
                jobDescription,
                candidate,
                questions,
                createdBy: user.id,
                createdAt: Date.now()
            };

            await repository.create(invite);

            results.push({
                id: sessionId,
                firstName: candidate.firstName,
                lastName: candidate.lastName,
                email: candidate.email,
                link: `${appBaseUrl}/s/${token}`
            });
        }

        const responseBody = { results, correlationId };

        if (idempotencyReserved && idempotencyKey) {
            await completeIdempotentRequest({
                scope: IDEMPOTENCY_SCOPE,
                actorId: user.id,
                key: idempotencyKey,
                statusCode: 200,
                body: responseBody
            });
        }

        routeLogger.info("Invite creation completed", {
            actorId: user.id,
            candidateCount: candidates.length,
            outcome: "success"
        });
        incrementMetric("recruiter_invite_create_total", { outcome: "success" });
        observeMetric("recruiter_invite_create_duration_ms", Date.now() - startedAt, { outcome: "success" });

        return NextResponse.json(responseBody);
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
