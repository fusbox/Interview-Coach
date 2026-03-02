"use server";

import { NextRequest, NextResponse } from "next/server";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { Logger } from "@/lib/logger";
import {
    EVAL_RUBRIC_DIMENSIONS,
    ExportSessionPayload,
    ExportQuestionPayload,
} from "@/app/(recruiter)/recruiter/dev-eval/types";

import { showDemoTools } from "@/lib/feature-flags";

const sessionRepo = new SupabaseSessionRepository();

export async function GET(
    req: NextRequest,
    { params }: { params: { sessionId: string } }
) {
    // Demo-mode gate (replaces hardcoded dev gate)
    if (!showDemoTools()) {
        return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    try {
        const session = await sessionRepo.get(params.sessionId);
        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        // Build export payload
        // Note: Tips and Strong Responses are NOT persisted in DB.
        // They would need to be fetched client-side or regenerated.
        // For now we include null placeholders — the client can
        // enrich these before final export if needed.
        const questions: ExportQuestionPayload[] = session.questions.map((q, idx) => {
            const answer = session.answers[q.id];
            return {
                questionIndex: idx,
                questionText: q.text,
                category: q.category,
                tips: null,
                strongResponse: null,
                candidateTranscript: answer?.transcript || undefined,
                submittedAt: answer?.submittedAt || undefined,
                feedback: answer?.analysis ? {
                    ack: answer.analysis.ack,
                    contentPulse: answer.analysis.contentPulse ? {
                        headline: answer.analysis.contentPulse.headline,
                        body: answer.analysis.contentPulse.body,
                        quote: answer.analysis.contentPulse.quote,
                    } : undefined,
                    deliveryPulse: answer.analysis.deliveryPulse ? {
                        headline: answer.analysis.deliveryPulse.headline,
                        body: answer.analysis.deliveryPulse.body,
                    } : undefined,
                    nextAction: answer.analysis.nextAction ? {
                        label: answer.analysis.nextAction.label,
                        actionType: answer.analysis.nextAction.actionType,
                    } : undefined,
                    meta: answer.analysis.meta ? {
                        tier: answer.analysis.meta.tier,
                        modality: answer.analysis.meta.modality,
                        signalQuality: answer.analysis.meta.signalQuality,
                        confidence: answer.analysis.meta.confidence,
                    } : undefined,
                } : null,
                evaluation: null, // Client-side will merge localStorage evals
            };
        });

        const payload: ExportSessionPayload = {
            exportedAt: new Date().toISOString(),
            rubricDefinition: EVAL_RUBRIC_DIMENSIONS,
            session: {
                id: session.id,
                candidateName: session.candidateName || 'Anonymous',
                role: session.role,
                jobDescription: session.jobDescription,
                status: session.status,
                questionCount: session.questions.length,
                answerCount: Object.keys(session.answers).length,
            },
            overallEvaluation: null, // Client-side will merge localStorage evals
            questions,
        };

        return NextResponse.json(payload);

    } catch (error) {
        Logger.error("[Dev] Export session failed", error);
        return NextResponse.json(
            { error: "Failed to export session" },
            { status: 500 }
        );
    }
}
