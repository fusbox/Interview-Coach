import { NextResponse } from "next/server";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { validatedSessionHandler } from "@/lib/server/api-handler-utils";

const repository = new SupabaseSessionRepository();

export async function POST(
    request: Request,
    { params }: { params: { session_id: string; question_id: string } }
) {
    return validatedSessionHandler(request, params, async (req, { session }) => {
        // Parse retryContext from body if present
        let retryContext;
        try {
            const body = await req.json();
            retryContext = body.retryContext;
        } catch {
            // No body or invalid JSON, ignore
        }

        const currentAns = session.answers[params.question_id];
        if (currentAns) {
            // Clear submission state but keep draft
            session.answers[params.question_id] = {
                ...currentAns,
                submittedAt: undefined,
                analysis: undefined,
                retryContext: retryContext // Persist context for next analysis
            };

            // If we want to be explicit about status, we could force it, 
            // but the selector derives it.
            // Update: We MUST force it, because Selector logic for REVIEW_FEEDBACK relies on status being 'REVIEWING'
            // if we are clearing analysis. So we must revert to 'IN_SESSION'.
            session.status = "IN_SESSION";
        }

        await repository.update(session);

        return NextResponse.json(session);
    });
}
