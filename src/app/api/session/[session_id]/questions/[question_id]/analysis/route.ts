import { NextResponse } from "next/server";
import { createSessionRepository } from "@/lib/server/infrastructure/session-repository";
import { AIService } from "@/lib/server/services/ai-service";
import { getAnalysisContext } from "@/lib/server/session/orchestrator";
import { SessionStatus } from "@/lib/domain/types";
import { isFeedbackFlowAnalysisReady } from "@/lib/domain/analysis-readiness";
import { buildAnalysisIdempotencyKey } from "@/lib/domain/idempotency-keys";
import { validatedSessionHandler } from "@/lib/server/api-handler-utils";
import { QuestionAnalysisRequestSchema } from "@/lib/domain/schemas";
import {
    errorResponse,
    notFoundResponse,
    validationErrorResponse
} from "@/lib/server/api-errors";
import { transitionSessionStatus } from "@/lib/domain/session-state-machine";
import type { InterviewSession } from "@/lib/domain/types";
import {
    beginIdempotentRequest,
    completeIdempotentRequest,
    releaseIdempotentRequest
} from "@/lib/server/idempotency";

const ANALYSIS_IDEMPOTENCY_SCOPE_PREFIX = "session_analysis";

function getCandidateProfileIdFromIntake(intakeData: InterviewSession["intakeData"]): string | undefined {
    const candidateProfileId = intakeData?.candidateProfileId;
    return typeof candidateProfileId === "string" && candidateProfileId.trim()
        ? candidateProfileId
        : undefined;
}

function resolveAnalysisAppName(session: InterviewSession): "recruiter_app" | "candidate_app" {
    if (getCandidateProfileIdFromIntake(session.intakeData)) {
        return "candidate_app";
    }

    const roleProfileId = session.intakeData?.roleProfileId;
    if (typeof roleProfileId === "string" && roleProfileId.trim()) {
        return "candidate_app";
    }

    return "recruiter_app";
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ session_id: string; question_id: string }> }
) {
    const resolvedParams = await params;
    return validatedSessionHandler(request, resolvedParams, async (req, { session, correlationId }) => {
        const answer = session.answers[resolvedParams.question_id];
        if (!answer?.submittedAt) {
            return validationErrorResponse(correlationId, "Answer not submitted");
        }

        if (isFeedbackFlowAnalysisReady(answer.analysis)) {
            return NextResponse.json(session);
        }

        const context = getAnalysisContext(session, resolvedParams.question_id);
        if (!context) {
            return notFoundResponse(correlationId, "Question context missing");
        }

        const body = await req.json().catch(() => ({}));
        const parseResult = QuestionAnalysisRequestSchema.safeParse(body);
        if (!parseResult.success) {
            return validationErrorResponse(correlationId);
        }
        const { audioData } = parseResult.data;
        const requestedModality = audioData ? "voice" : answer.modality;
        const scope = `${ANALYSIS_IDEMPOTENCY_SCOPE_PREFIX}:${resolvedParams.question_id}`;
        const idempotencyKey = req.headers.get("Idempotency-Key")?.trim()
            || buildAnalysisIdempotencyKey(session.id, resolvedParams.question_id, {
                ...answer,
                modality: requestedModality,
            });
        let idempotencyReserved = false;

        const reservation = await beginIdempotentRequest({
            scope,
            actorId: resolvedParams.session_id,
            key: idempotencyKey,
            payload: {
                questionId: resolvedParams.question_id,
                submittedAt: answer.submittedAt,
                transcript: answer.transcript,
                modality: requestedModality,
                retryContext: answer.retryContext,
            },
        });

        if (reservation.kind === "replay") {
            return NextResponse.json(reservation.body, { status: reservation.statusCode });
        }

        if (reservation.kind === "pending") {
            return errorResponse(409, {
                code: "REQUEST_IN_PROGRESS",
                message: "An identical answer analysis request is already in progress",
                correlationId,
                retryable: true,
            });
        }

        if (reservation.kind === "conflict") {
            return errorResponse(409, {
                code: "IDEMPOTENCY_MISMATCH",
                message: "Idempotency key cannot be reused with a different submitted answer",
                correlationId,
                retryable: false,
            });
        }

        idempotencyReserved = true;

        const questionIndex = session.questions.findIndex(q => q.id === resolvedParams.question_id);
        const progress = {
            current: questionIndex + 1,
            total: session.questions.length
        };

        try {
            const appName = resolveAnalysisAppName(session);
            const candidateId = getCandidateProfileIdFromIntake(session.intakeData);
            const analysis = await AIService.analyzeAnswer(
                context.question,
                answer.transcript || null,
                audioData || null,
                context.blueprint,
                session.intakeData,
                answer.retryContext,
                progress,
                {
                    appName,
                    correlationId,
                    sessionId: session.id,
                    createdBy: appName === "recruiter_app" ? session.recruiterId : undefined,
                    candidateId: appName === "candidate_app" ? candidateId : undefined,
                    sourceRefs: [
                        {
                            type: "route",
                            route: "/api/session/[session_id]/questions/[question_id]/analysis",
                        },
                        {
                            type: "question",
                            questionId: resolvedParams.question_id,
                        },
                    ],
                    privacyFlags: requestedModality === "voice" ? ["contains_audio_input"] : [],
                }
            );
            const resolvedModality = audioData ? "voice" : analysis.meta?.modality ?? answer.modality;

            const updatedSession = {
                ...session,
                status: transitionSessionStatus(session, "REVIEWING").status as SessionStatus,
                answers: {
                    ...session.answers,
                    [resolvedParams.question_id]: {
                        ...answer,
                        modality: resolvedModality,
                        transcript: analysis.transcript || answer.transcript,
                        analysis
                    }
                }
            };

            const repository = await createSessionRepository();
            await repository.update(updatedSession);

            if (idempotencyReserved) {
                await completeIdempotentRequest({
                    scope,
                    actorId: resolvedParams.session_id,
                    key: idempotencyKey,
                    statusCode: 200,
                    body: updatedSession,
                });
            }

            return NextResponse.json(updatedSession);
        } catch (error) {
            if (idempotencyReserved) {
                await releaseIdempotentRequest({
                    scope,
                    actorId: resolvedParams.session_id,
                    key: idempotencyKey,
                });
            }

            throw error;
        }
    });
}
