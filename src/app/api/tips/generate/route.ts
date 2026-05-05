import { NextRequest, NextResponse } from "next/server";
import { GenerateTipsRequestSchema } from "@/lib/domain/schemas";
import { TipsService } from "@/lib/server/services/tips-service";
import { Logger } from "@/lib/logger";
import {
    createCorrelationId,
    errorResponse,
    internalErrorResponse,
    validationErrorResponse
} from "@/lib/server/api-errors";
import { enforceIpRateLimit } from "@/lib/server/abuse-protection";
import { authorizeCandidateSessionRequest } from "@/lib/server/candidate-route-auth";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import {
    beginIdempotentRequest,
    completeIdempotentRequest,
    releaseIdempotentRequest
} from "@/lib/server/idempotency";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_TIPS_REQUESTS = 30;
const TIPS_IDEMPOTENCY_SCOPE = "tips_generate";
const repository = new SupabaseSessionRepository();

export async function POST(req: NextRequest) {
    const correlationId = createCorrelationId();

    try {
        const rateLimitResponse = await enforceIpRateLimit({
            request: req,
            scope: "tips_generate",
            correlationId,
            maxRequests: MAX_TIPS_REQUESTS,
            windowMs: WINDOW_MS
        });
        if (rateLimitResponse) {
            return rateLimitResponse;
        }

        const body = await req.json();

        // Validate input
        const validation = GenerateTipsRequestSchema.safeParse(body);
        if (!validation.success) {
            return validationErrorResponse(correlationId);
        }

        const { question, role, competency, blueprint, resumeText, sessionId } = validation.data;
        const authResponse = await authorizeCandidateSessionRequest(req, sessionId, correlationId);
        if (authResponse) {
            return authResponse;
        }
        const session = await repository.get(sessionId);

        const idempotencyKey = req.headers.get("Idempotency-Key")?.trim() || null;
        let idempotencyReserved = false;

        if (idempotencyKey) {
            const reservation = await beginIdempotentRequest({
                scope: TIPS_IDEMPOTENCY_SCOPE,
                actorId: sessionId,
                key: idempotencyKey,
                payload: validation.data,
            });

            if (reservation.kind === "replay") {
                return NextResponse.json(reservation.body, { status: reservation.statusCode });
            }

            if (reservation.kind === "pending") {
                return errorResponse(409, {
                    code: "REQUEST_IN_PROGRESS",
                    message: "An identical tips request is already in progress",
                    correlationId,
                    retryable: true,
                });
            }

            if (reservation.kind === "conflict") {
                return errorResponse(409, {
                    code: "IDEMPOTENCY_MISMATCH",
                    message: "Idempotency key cannot be reused with a different payload",
                    correlationId,
                    retryable: false,
                });
            }

            idempotencyReserved = true;
        }

        try {
            // Generate Tips
            const tips = await TipsService.generateTips(
                question,
                role,
                competency,
                blueprint,
                resumeText,
                {
                    appName: "candidate_app",
                    correlationId,
                    sessionId,
                    sourceRefs: [{ type: "route", route: "/api/tips/generate" }],
                    createdBy: session?.recruiterId,
                    privacyFlags: resumeText ? ["contains_resume"] : [],
                }
            );

            if (idempotencyReserved && idempotencyKey) {
                await completeIdempotentRequest({
                    scope: TIPS_IDEMPOTENCY_SCOPE,
                    actorId: sessionId,
                    key: idempotencyKey,
                    statusCode: 200,
                    body: tips,
                });
            }

            return NextResponse.json(tips);
        } catch (error) {
            if (idempotencyReserved && idempotencyKey) {
                await releaseIdempotentRequest({
                    scope: TIPS_IDEMPOTENCY_SCOPE,
                    actorId: sessionId,
                    key: idempotencyKey,
                });
            }

            throw error;
        }

    } catch (error) {
        Logger.error("[API] Tips Generation Failed", { correlationId, error }, "TipsAPI");
        return internalErrorResponse(correlationId);
    }
}
