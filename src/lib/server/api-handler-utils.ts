import { NextResponse } from "next/server";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { requireCandidateToken } from "@/lib/server/auth/candidate-token";
import { InterviewSession } from "@/lib/domain/types";
import { Logger } from "@/lib/logger";

const repository = new SupabaseSessionRepository();

export type ValidatedSessionHandler = (
    request: Request,
    context: {
        params: { session_id: string; question_id: string };
        session: InterviewSession;
    }
) => Promise<NextResponse>;

/**
 * Wraps an API route handler with standard candidate authentication and session validation.
 * Eliminates repetitive boilerplate across session-[id]-questions-[id] routes.
 * 
 * @param handler The core business logic to execute if validation passes.
 */
export async function validatedSessionHandler(
    request: Request,
    params: { session_id: string; question_id: string },
    handler: ValidatedSessionHandler
): Promise<NextResponse> {
    try {
        // 1. Authentication
        const auth = await requireCandidateToken(request, params.session_id);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        // 2. Session Existence
        const session = await repository.get(params.session_id);
        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        // 3. Question Existence
        const questionExists = session.questions.some(q => q.id === params.question_id);
        if (!questionExists) {
             return NextResponse.json({ error: "Question not found in this session" }, { status: 404 });
        }

        // 4. Execute Core Handler
        return await handler(request, { params, session });

    } catch (error) {
        Logger.error(`[ValidatedHandler] Error in route ${request.url}:`, error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
