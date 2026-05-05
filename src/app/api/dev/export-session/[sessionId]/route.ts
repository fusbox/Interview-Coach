"use server";

import { NextRequest, NextResponse } from "next/server";
import { createSessionRepository } from "@/lib/server/infrastructure/session-repository";
import { Logger } from "@/lib/logger";
import {
    EVAL_RUBRIC_DIMENSIONS,
    ExportSessionPayload,
    ExportQuestionPayload,
} from "@/app/(recruiter)/recruiter/dev-eval/types";

import { showDemoTools } from "@/lib/feature-flags";
import {
    createCorrelationId,
    internalErrorResponse,
    notFoundResponse
} from "@/lib/server/api-errors";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const correlationId = createCorrelationId();
    const { sessionId } = await params;

    // Internal demo-only export route for the dev evaluation workspace.
    // This route is intentionally outside the recruiter-facing product contract.
    if (!showDemoTools()) {
        return notFoundResponse(correlationId, "Not available");
    }

    try {
        const sessionRepo = await createSessionRepository();
        const session = await sessionRepo.get(sessionId);
        if (!session) {
            return notFoundResponse(correlationId, "Session not found");
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
                    feedbackPlan: answer.analysis.feedbackPlan ? {
                        centralRead: answer.analysis.feedbackPlan.centralRead,
                        signal: {
                            valence: answer.analysis.feedbackPlan.signal.valence,
                            detectability: answer.analysis.feedbackPlan.signal.detectability,
                        },
                        primaryAnchor: {
                            source: answer.analysis.feedbackPlan.primaryAnchor.source,
                            signalType: answer.analysis.feedbackPlan.primaryAnchor.signalType,
                            dimension: answer.analysis.feedbackPlan.primaryAnchor.dimension,
                            candidateEvidence: answer.analysis.feedbackPlan.primaryAnchor.candidateEvidence,
                            interviewerValue: answer.analysis.feedbackPlan.primaryAnchor.interviewerValue,
                        },
                        intervention: {
                            type: answer.analysis.feedbackPlan.intervention.type,
                            reason: answer.analysis.feedbackPlan.intervention.reason,
                        },
                    } : undefined,
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
                        confidence: answer.analysis.meta.confidence,
                        readinessLevel: answer.analysis.meta.readinessLevel,
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
        Logger.error("[Dev] Export session failed", { correlationId, error }, "DevExportAPI");
        return internalErrorResponse(correlationId);
    }
}
