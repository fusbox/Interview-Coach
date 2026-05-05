import { NextResponse } from "next/server";
import { createSessionRepository } from "@/lib/server/infrastructure/session-repository";
import { AIService } from "@/lib/server/services/ai-service";
import { getAnalysisContext } from "@/lib/server/session/orchestrator";
import { SessionStatus } from "@/lib/domain/types";
import { validatedSessionHandler } from "@/lib/server/api-handler-utils";
import { QuestionAnalysisRequestSchema } from "@/lib/domain/schemas";
import {
    notFoundResponse,
    validationErrorResponse
} from "@/lib/server/api-errors";
import { transitionSessionStatus } from "@/lib/domain/session-state-machine";

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

        if (answer.analysis) {
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

        const questionIndex = session.questions.findIndex(q => q.id === resolvedParams.question_id);
        const progress = {
            current: questionIndex + 1,
            total: session.questions.length
        };

        const analysis = await AIService.analyzeAnswer(
            context.question,
            answer.transcript || null,
            audioData || null,
            context.blueprint,
            session.intakeData,
            answer.retryContext,
            progress
        );

        const updatedSession = {
            ...session,
            status: transitionSessionStatus(session, "REVIEWING").status as SessionStatus,
            answers: {
                ...session.answers,
                [resolvedParams.question_id]: {
                    ...answer,
                    transcript: analysis.transcript || answer.transcript,
                    analysis
                }
            }
        };

        const repository = await createSessionRepository();
        await repository.update(updatedSession);

        return NextResponse.json(updatedSession);
    });
}
