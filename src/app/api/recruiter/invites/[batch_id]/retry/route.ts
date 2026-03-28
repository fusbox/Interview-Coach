import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/server/api-errors";
import { createServerLogger } from "@/lib/server/server-logger";
import { getAppOrigin } from "@/lib/server/url/get-app-origin";
import { retryInviteBatch, InviteBatchRetryNotFoundError, InviteBatchRetryValidationError } from "@/lib/server/application/invites/retry-invite-batch";
import {
    beginIdempotentRequest,
    completeIdempotentRequest,
    releaseIdempotentRequest
} from "@/lib/server/idempotency";

const IDEMPOTENCY_SCOPE = "recruiter_invites:retry";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ batch_id: string }> }
) {
    const correlationId = crypto.randomUUID();
    const { batch_id } = await params;
    let actorId: string | null = null;
    let idempotencyReserved = false;
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() || `retry:${batch_id}`;
    const routeLogger = createServerLogger("RecruiterInviteBatchRetryAPI", {
        correlationId,
        route: "/api/recruiter/invites/[batch_id]/retry",
        actorType: "recruiter",
        method: request.method
    });

    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return errorResponse(401, {
                code: "UNAUTHORIZED",
                message: "Authentication required",
                correlationId,
                retryable: false
            });
        }

        actorId = user.id;

        const reservation = await beginIdempotentRequest({
            scope: IDEMPOTENCY_SCOPE,
            actorId: user.id,
            key: idempotencyKey,
            payload: { batchId: batch_id }
        });

        if (reservation.kind === "replay") {
            return NextResponse.json(reservation.body, { status: reservation.statusCode });
        }

        if (reservation.kind === "pending") {
            return errorResponse(409, {
                code: "REQUEST_IN_PROGRESS",
                message: "A retry request for this invite batch is already in progress",
                correlationId,
                retryable: true
            });
        }

        if (reservation.kind === "conflict") {
            return errorResponse(409, {
                code: "IDEMPOTENCY_MISMATCH",
                message: "Idempotency key cannot be reused with a different retry payload",
                correlationId,
                retryable: false
            });
        }

        idempotencyReserved = true;
        const result = await retryInviteBatch(batch_id, user.id, getAppOrigin(request.url));
        const responseStatus = result.summary.hasFailures ? 207 : 200;
        const responseBody = {
            ...result,
            correlationId
        };

        await completeIdempotentRequest({
            scope: IDEMPOTENCY_SCOPE,
            actorId: user.id,
            key: idempotencyKey,
            statusCode: responseStatus,
            body: responseBody
        });

        return NextResponse.json(responseBody, { status: responseStatus });
    } catch (error) {
        if (error instanceof InviteBatchRetryNotFoundError) {
            return errorResponse(404, {
                code: "NOT_FOUND",
                message: error.message,
                correlationId,
                retryable: false
            });
        }

        if (error instanceof InviteBatchRetryValidationError) {
            return errorResponse(400, {
                code: "INVALID_REQUEST",
                message: error.message,
                correlationId,
                retryable: false
            });
        }

        routeLogger.error("Failed to retry invite batch", {
            error,
            errorCode: "RECRUITER_INVITE_BATCH_RETRY_FAILED"
        });

        if (idempotencyReserved && actorId) {
            await releaseIdempotentRequest({
                scope: IDEMPOTENCY_SCOPE,
                actorId,
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
