import { NextResponse } from "next/server";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { AIService } from "@/lib/server/services/ai-service";
import { getAnalysisContext } from "@/lib/server/session/orchestrator";
import { SessionStatus } from "@/lib/domain/types";
import { validatedSessionHandler } from "@/lib/server/api-handler-utils";

const repository = new SupabaseSessionRepository();

export async function POST(
    request: Request,
    { params }: { params: { session_id: string; question_id: string } }
) {
    return validatedSessionHandler(request, params, async (req, { session }) => {
        const answer = session.answers[params.question_id];
        if (!answer?.submittedAt) {
            return NextResponse.json({ error: "Answer not submitted" }, { status: 400 });
        }

        if (answer.analysis) {
            return NextResponse.json(session);
        }

        const context = getAnalysisContext(session, params.question_id);
        if (!context) {
            return NextResponse.json({ error: "Question context missing" }, { status: 404 });
        }

        const body = await req.json().catch(() => ({}));
        const { audioData } = body;

        const questionIndex = session.questions.findIndex(q => q.id === params.question_id);
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
            status: "REVIEWING" as SessionStatus,
            answers: {
                ...session.answers,
                [params.question_id]: {
                    ...answer,
                    transcript: analysis.transcript || answer.transcript,
                    analysis
                }
            }
        };

        await repository.update(updatedSession);

        return NextResponse.json(updatedSession);
    });
}
