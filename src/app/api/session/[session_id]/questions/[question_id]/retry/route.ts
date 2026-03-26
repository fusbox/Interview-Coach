import { NextResponse } from "next/server";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { validatedSessionHandler } from "@/lib/server/api-handler-utils";
import { transitionSessionStatus } from "@/lib/domain/session-state-machine";
import { QuestionRetryRequestSchema } from "@/lib/domain/schemas";
import { validationErrorResponse } from "@/lib/server/api-errors";

const repository = new SupabaseSessionRepository();

export async function POST(
    request: Request,
    { params }: { params: Promise<{ session_id: string; question_id: string }> }
) {
    const resolvedParams = await params;
    return validatedSessionHandler(request, resolvedParams, async (req, { session, correlationId }) => {
        const body = await req.json().catch(() => ({}));
        const parseResult = QuestionRetryRequestSchema.safeParse(body);
        if (!parseResult.success) {
            return validationErrorResponse(correlationId);
        }
        const retryContext = parseResult.data.retryContext;

        const currentAns = session.answers[resolvedParams.question_id];
        if (currentAns) {
            // Clear submission state but keep draft
            session.answers[resolvedParams.question_id] = {
                ...currentAns,
                submittedAt: undefined,
                analysis: undefined,
                retryContext: retryContext // Persist context for next analysis
            };

            // If we want to be explicit about status, we could force it, 
            // but the selector derives it.
            // Update: We MUST force it, because Selector logic for REVIEW_FEEDBACK relies on status being 'REVIEWING'
            // if we are clearing analysis. So we must revert to 'IN_SESSION'.
            session.status = transitionSessionStatus(session, "IN_SESSION").status;
        }

        await repository.deleteAnalysis(resolvedParams.session_id, resolvedParams.question_id);
        await repository.update(session);

        return NextResponse.json(session);
    });
}
