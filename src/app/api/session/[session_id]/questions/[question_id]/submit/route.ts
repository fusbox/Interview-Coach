import { NextResponse } from "next/server";
import { submitAnswer } from "@/lib/server/session/orchestrator";
import { createSessionRepository } from "@/lib/server/infrastructure/session-repository";
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
import { incrementMetric } from "@/lib/server/metrics";

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
        const analysisIncluded = parseResult.success ? Boolean(parseResult.data.analysis) : false;

        const recordSubmitOutcome = (outcome: string) => {
            incrementMetric("session_submit_total", {
                outcome,
                analysisIncluded
            });
        };

        if (!parseResult.success) {
            recordSubmitOutcome("invalid_request");
            return validationErrorResponse(correlationId);
        }

        const { text, analysis, modality } = parseResult.data;
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
                recordSubmitOutcome("replay_success");
                return NextResponse.json(reservation.body, { status: reservation.statusCode });
            }

            if (reservation.kind === "pending") {
                recordSubmitOutcome("request_in_progress");
                return errorResponse(409, {
                    code: "REQUEST_IN_PROGRESS",
                    message: "An identical submit request is already in progress",
                    correlationId,
                    retryable: true
                });
            }

            if (reservation.kind === "conflict") {
                recordSubmitOutcome("idempotency_mismatch");
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
            recordSubmitOutcome("replay_success");
            return NextResponse.json(responseBody);
        }

        try {
            const updatedSession = submitAnswer(session, resolvedParams.question_id, answer, analysis || undefined, modality);

            // Ensure atomic state by clearing existing analysis before update
            const repository = await createSessionRepository();
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

            recordSubmitOutcome("success");
            return NextResponse.json(updatedSession);
        } catch (error) {
            if (idempotencyReserved && idempotencyKey) {
                await releaseIdempotentRequest({
                    scope,
                    actorId: resolvedParams.session_id,
                    key: idempotencyKey
                });
            }

            recordSubmitOutcome("error");
            throw error;
        }
    });
}
