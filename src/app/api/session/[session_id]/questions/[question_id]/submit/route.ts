import { NextResponse } from "next/server";
import { submitAnswer } from "@/lib/server/session/orchestrator";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { z } from "zod";
import { validatedSessionHandler } from "@/lib/server/api-handler-utils";
import { validationErrorResponse } from "@/lib/server/api-errors";

const repository = new SupabaseSessionRepository();

export async function POST(
    request: Request,
    { params }: { params: { session_id: string; question_id: string } }
) {
    return validatedSessionHandler(request, params, async (req, { session, correlationId }) => {
        const body = await req.json();
        const parseResult = z.object({
            text: z.string(),
            analysis: z.any().optional()
        }).safeParse(body);

        if (!parseResult.success) {
            return validationErrorResponse(correlationId);
        }

        const { text, analysis } = parseResult.data;

        const answer = text;

        const existingAnswer = session.answers[params.question_id];
        if (existingAnswer?.submittedAt) {
            return NextResponse.json(session);
        }

        const updatedSession = submitAnswer(session, params.question_id, answer, analysis || undefined);

        // Ensure atomic state by clearing existing analysis before update
        await repository.deleteAnalysis(params.session_id, params.question_id);
        await repository.update(updatedSession);

        return NextResponse.json(updatedSession);
    });
}
