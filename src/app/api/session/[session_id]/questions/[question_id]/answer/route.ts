import { NextResponse } from "next/server";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { z } from "zod";
import { validatedSessionHandler } from "@/lib/server/api-handler-utils";
import { validationErrorResponse } from "@/lib/server/api-errors";

const repository = new SupabaseSessionRepository();

const DraftSchema = z.object({
    text: z.string(),
    isFinal: z.boolean().optional() // For future use if we merge submit/draft
});

export async function PUT(
    request: Request,
    { params }: { params: { session_id: string; question_id: string } }
) {
    return validatedSessionHandler(request, params, async (req, { correlationId }) => {
        const body = await req.json();
        const parseResult = DraftSchema.safeParse(body);

        if (!parseResult.success) {
            return validationErrorResponse(correlationId);
        }

        const { text } = parseResult.data;

        // ATOMIC DRAFT SAVE (Fixes race condition with Submit/Analyze)
        // We do NOT fetch the whole session to avoid overwriting status with stale data.
        await repository.saveDraft(params.session_id, params.question_id, text);

        return NextResponse.json({ success: true });
    });
}
