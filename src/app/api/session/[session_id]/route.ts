import { NextResponse } from "next/server";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { requireCandidateToken } from "@/lib/server/auth/candidate-token";
import { UpdateSessionSchema } from "@/lib/domain/schemas";
import { AIService } from "@/lib/server/services/ai-service";

const repository = new SupabaseSessionRepository();

export async function GET(
    request: Request,
    { params }: { params: { session_id: string } }
) {
    const auth = await requireCandidateToken(request, params.session_id);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const session = await repository.get(params.session_id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // Mark as viewed asynchronously (don't block the response)
    // We only mark viewed if it's the candidate fetching it (verified by auth above)
    repository.markViewed(params.session_id).catch(err => console.error("Mark Viewed Failed:", err));

    return NextResponse.json(session);
}

export async function PATCH(
    request: Request,
    { params }: { params: { session_id: string } }
) {
    const { session_id } = params;
    const auth = await requireCandidateToken(request, session_id);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        const body = await request.json();
        const parseResult = UpdateSessionSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json(
                { error: "Invalid request", details: parseResult.error.format() },
                { status: 400 }
            );
        }
        const updates = parseResult.data;

        // Atomic Partial Update
        await repository.updatePartial(session_id, updates);

        // Fetch Fresh State
        const session = await repository.get(session_id);
        if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

        // Trigger Summarization if newly completed
        if (updates.status === 'COMPLETED' && !session.summaryNarrative) {
            console.log(`[API] Triggering summarization for session ${session_id}`);
            try {
                const narrative = await AIService.summarizeSession(session);
                await repository.updatePartial(session_id, { summaryNarrative: narrative });
                session.summaryNarrative = narrative;
            } catch (summaryError) {
                console.error("[API] Summarization failed:", summaryError);
                // We still return the session even if summarization fails; polling will try again or show fallback
            }
        }

        return NextResponse.json(session);

    } catch (error) {
        console.error("[API] Session Update PATCH Error:", error);
        return NextResponse.json({ error: "Update failed", details: String(error) }, { status: 500 });
    }
}
