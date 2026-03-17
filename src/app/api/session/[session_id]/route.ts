import { NextResponse } from "next/server";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { requireCandidateToken } from "@/lib/server/auth/candidate-token";
import { UpdateSessionSchema } from "@/lib/domain/schemas";
import { AIService } from "@/lib/server/services/ai-service";
import { EmailService } from "@/lib/server/services/email-service";
import { Logger } from "@/lib/logger";
import { canTransitionSessionStatus } from "@/lib/domain/session-state-machine";
import {
    createCorrelationId,
    forbiddenResponse,
    internalErrorResponse,
    notFoundResponse,
    unauthorizedResponse,
    validationErrorResponse
} from "@/lib/server/api-errors";

const repository = new SupabaseSessionRepository();

export async function GET(
    request: Request,
    { params }: { params: { session_id: string } }
) {
    const correlationId = createCorrelationId();
    const auth = await requireCandidateToken(request, params.session_id);
    if (!auth.ok) {
        if (auth.status === 401) {
            return unauthorizedResponse(correlationId, auth.error);
        }

        return forbiddenResponse(correlationId, auth.error);
    }

    const session = await repository.get(params.session_id);
    if (!session) return notFoundResponse(correlationId, "Session not found");

    // Mark as viewed asynchronously (don't block the response)
    // We only mark viewed if it's the candidate fetching it (verified by auth above)
    repository.markViewed(params.session_id).catch(err => Logger.warn("Mark Viewed Failed", { correlationId, error: err }, "SessionAPI"));

    return NextResponse.json(session);
}

export async function PATCH(
    request: Request,
    { params }: { params: { session_id: string } }
) {
    const correlationId = createCorrelationId();
    const { session_id } = params;
    const auth = await requireCandidateToken(request, session_id);
    if (!auth.ok) {
        if (auth.status === 401) {
            return unauthorizedResponse(correlationId, auth.error);
        }

        return forbiddenResponse(correlationId, auth.error);
    }

    try {
        const body = await request.json();
        const parseResult = UpdateSessionSchema.safeParse(body);
        if (!parseResult.success) {
            return validationErrorResponse(correlationId);
        }
        const updates = parseResult.data;

        // Atomic Partial Update
        const currentSession = await repository.get(session_id);
        if (!currentSession) return notFoundResponse(correlationId, "Session not found");

        if (updates.status && !canTransitionSessionStatus(currentSession.status, updates.status)) {
            return validationErrorResponse(
                correlationId,
                `Invalid session status transition: ${currentSession.status} -> ${updates.status}`
            );
        }

        await repository.updatePartial(session_id, updates);

        // Fetch Fresh State
        const session = await repository.get(session_id);
        if (!session) return notFoundResponse(correlationId, "Session not found");

        // Trigger Summarization if newly completed
        if (updates.status === 'COMPLETED' && !session.summaryNarrative) {
            Logger.info("Triggering summarization for completed session", { correlationId, sessionId: session_id }, "SessionAPI");
            try {
                const narrative = await AIService.summarizeSession(session);
                await repository.updatePartial(session_id, { summaryNarrative: narrative });
                session.summaryNarrative = narrative;

                // Trigger Email Debrief
                if (session.candidate?.email) {
                    await EmailService.sendDebriefEmail(session).catch(err => 
                        Logger.error("Debrief email send failed", { correlationId, error: err, sessionId: session_id }, "SessionAPI")
                    );
                }
            } catch (summaryError) {
                Logger.error("Summarization failed", { correlationId, error: summaryError, sessionId: session_id }, "SessionAPI");
                // We still return the session even if summarization fails; polling will try again or show fallback
            }
        }

        return NextResponse.json(session);

    } catch (error) {
        Logger.error("Session Update PATCH Error", { correlationId, error }, "SessionAPI");
        return internalErrorResponse(correlationId);
    }
}
