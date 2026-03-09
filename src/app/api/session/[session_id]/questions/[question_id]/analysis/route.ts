import { NextResponse } from "next/server";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { AIService } from "@/lib/server/services/ai-service";
import { getAnalysisContext } from "@/lib/server/session/orchestrator";
import { requireCandidateToken } from "@/lib/server/auth/candidate-token";
import { SessionStatus } from "@/lib/domain/types";
import { Logger } from "@/lib/logger";

const repository = new SupabaseSessionRepository();

export async function POST(
    request: Request,
    { params }: { params: { session_id: string; question_id: string } }
) {
    try {
        const auth = await requireCandidateToken(request, params.session_id);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const session = await repository.get(params.session_id);
        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

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

        const body = await request.json().catch(() => ({}));
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
    } catch (error) {
        Logger.error("Analysis Trigger Failed", error);
        return NextResponse.json({ error: "Failed to analyze answer" }, { status: 500 });
    }
}
