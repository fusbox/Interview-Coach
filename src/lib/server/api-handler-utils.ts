import { NextResponse } from "next/server";
import { createSessionRepository } from "@/lib/server/infrastructure/session-repository";
import { requireCandidateToken } from "@/lib/server/auth/candidate-token";
import { InterviewSession } from "@/lib/domain/types";
import {
    createCorrelationId,
    forbiddenResponse,
    internalErrorResponse,
    notFoundResponse,
    unauthorizedResponse
} from "@/lib/server/api-errors";
import { createServerLogger } from "@/lib/server/server-logger";

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
    const routeLogger = createServerLogger("ValidatedHandler", {
        correlationId,
        route: new URL(request.url).pathname,
        actorType: "candidate",
        sessionId: params.session_id
    });

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
        const repository = await createSessionRepository();
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
        routeLogger.error("Validated session route failed", {
            error,
            errorCode: "VALIDATED_SESSION_ROUTE_FAILED"
        });
        return internalErrorResponse(correlationId);
    }
}
