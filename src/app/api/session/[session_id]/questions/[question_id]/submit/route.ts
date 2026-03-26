import { NextResponse } from "next/server";
import { submitAnswer } from "@/lib/server/session/orchestrator";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { validatedSessionHandler } from "@/lib/server/api-handler-utils";
import { SubmitAnswerRequestSchema } from "@/lib/domain/schemas";
import {
    errorResponse,
    validationErrorResponse
} from "@/lib/server/api-errors";
import {
    beginIdempotentRequest,
    completeIdempotentRequest,
    releaseIdempotentRequest
} from "@/lib/server/idempotency";

const repository = new SupabaseSessionRepository();
const SUBMIT_SCOPE_PREFIX = "session_submit";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ session_id: string; question_id: string }> }
) {
    const resolvedParams = await params;
    return validatedSessionHandler(request, resolvedParams, async (req, { session, correlationId }) => {
        const idempotencyKey = req.headers.get("Idempotency-Key")?.trim() || null;
        const body = await req.json();
        const parseResult = SubmitAnswerRequestSchema.safeParse(body);

        if (!parseResult.success) {
            return validationErrorResponse(correlationId);
        }

        const { text, analysis } = parseResult.data;
        const scope = `${SUBMIT_SCOPE_PREFIX}:${resolvedParams.question_id}`;
        let idempotencyReserved = false;

        if (idempotencyKey) {
            const reservation = await beginIdempotentRequest({
                scope,
                actorId: resolvedParams.session_id,
                key: idempotencyKey,
                payload: parseResult.data
            });

            if (reservation.kind === "replay") {
                return NextResponse.json(reservation.body, { status: reservation.statusCode });
            }

            if (reservation.kind === "pending") {
                return errorResponse(409, {
                    code: "REQUEST_IN_PROGRESS",
                    message: "An identical submit request is already in progress",
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

        const answer = text;

        const existingAnswer = session.answers[resolvedParams.question_id];
        if (existingAnswer?.submittedAt) {
            const responseBody = session;
            if (idempotencyReserved && idempotencyKey) {
                await completeIdempotentRequest({
                    scope,
                    actorId: resolvedParams.session_id,
                    key: idempotencyKey,
                    statusCode: 200,
                    body: responseBody
                });
            }
            return NextResponse.json(responseBody);
        }

        try {
            const updatedSession = submitAnswer(session, resolvedParams.question_id, answer, analysis || undefined);

            // Ensure atomic state by clearing existing analysis before update
            await repository.deleteAnalysis(resolvedParams.session_id, resolvedParams.question_id);
            await repository.update(updatedSession);

            if (idempotencyReserved && idempotencyKey) {
                await completeIdempotentRequest({
                    scope,
                    actorId: resolvedParams.session_id,
                    key: idempotencyKey,
                    statusCode: 200,
                    body: updatedSession
                });
            }

            return NextResponse.json(updatedSession);
        } catch (error) {
            if (idempotencyReserved && idempotencyKey) {
                await releaseIdempotentRequest({
                    scope,
                    actorId: resolvedParams.session_id,
                    key: idempotencyKey
                });
            }

            throw error;
        }
    });
}
