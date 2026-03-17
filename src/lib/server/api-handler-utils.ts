import { NextResponse } from "next/server";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { requireCandidateToken } from "@/lib/server/auth/candidate-token";
import { InterviewSession } from "@/lib/domain/types";
import { Logger } from "@/lib/logger";
import {
    createCorrelationId,
    forbiddenResponse,
    internalErrorResponse,
    notFoundResponse,
    unauthorizedResponse
} from "@/lib/server/api-errors";

const repository = new SupabaseSessionRepository();

export type ValidatedSessionHandler = (
    request: Request,
    context: {
        params: { session_id: string; question_id: string };
        session: InterviewSession;
        correlationId: string;
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
    const correlationId = createCorrelationId();

    try {
        // 1. Authentication
        const auth = await requireCandidateToken(request, params.session_id);
        if (!auth.ok) {
            if (auth.status === 401) {
                return unauthorizedResponse(correlationId, auth.error);
            }

            return forbiddenResponse(correlationId, auth.error);
        }

        // 2. Session Existence
        const session = await repository.get(params.session_id);
        if (!session) {
            return notFoundResponse(correlationId, "Session not found");
        }

        // 3. Question Existence
        const questionExists = session.questions.some(q => q.id === params.question_id);
        if (!questionExists) {
             return notFoundResponse(correlationId, "Question not found in this session");
        }

        // 4. Execute Core Handler
        return await handler(request, { params, session, correlationId });

    } catch (error) {
        Logger.error(`[ValidatedHandler] Error in route ${request.url}:`, error);
        return internalErrorResponse(correlationId);
    }
}
