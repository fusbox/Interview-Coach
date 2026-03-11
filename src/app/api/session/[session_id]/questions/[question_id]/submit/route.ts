import { NextResponse } from "next/server";
import { submitAnswer } from "@/lib/server/session/orchestrator";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { z } from "zod";
import { validatedSessionHandler } from "@/lib/server/api-handler-utils";

const repository = new SupabaseSessionRepository();

export async function POST(
    request: Request,
    { params }: { params: { session_id: string; question_id: string } }
) {
    return validatedSessionHandler(request, params, async (req, { session }) => {
        const body = await req.json();
        const { text, analysis } = z.object({
            text: z.string(),
            analysis: z.any().optional() // Allow client to pass partial analysis or none
        }).parse(body);

        const answer = text; // Alias for internal logic

        console.log(`[SubmitAPI] Submitting answer for Q: ${params.question_id}`);

        const existingAnswer = session.answers[params.question_id];
        if (existingAnswer?.submittedAt) {
            return NextResponse.json(session);
        }

        const updatedSession = submitAnswer(session, params.question_id, answer, analysis || undefined);
        console.log(`[SubmitAPI] Session Updated (Memory), Status: ${updatedSession.status}`);

        // 3. Persist
        // Ensure we clear any previous analysis (stale feedback bug)
        await repository.deleteAnalysis(params.session_id, params.question_id);

        await repository.update(updatedSession);
        console.log(`[SubmitAPI] Session Persisted to DB`);

        return NextResponse.json(updatedSession);
    });
}
