/**
 * Export utilities for the dev evaluation module.
 * 
 * Builds structured JSON payloads optimized for LLM consumption
 * and triggers browser downloads.
 */

import {
    EVAL_RUBRIC_DIMENSIONS,
    SessionEval,
    ExportSessionPayload,
    ExportBatchPayload,
    ExportQuestionPayload,
} from './types';
import { InterviewSession } from '@/lib/domain/types';

/**
 * Build a single session export payload, merging session data with evaluator scores.
 * Tips and strong responses are passed in as pre-fetched data since they are generated on-demand.
 */
export function buildSessionPayload(
    session: InterviewSession,
    evaluation: SessionEval | null,
    tipsData: Record<string, unknown>,      // keyed by questionId
    strongResponseData: Record<string, unknown>, // keyed by questionId
): ExportSessionPayload {
    const questions: ExportQuestionPayload[] = session.questions.map((q, idx) => {
        const answer = session.answers[q.id];
        const questionEval = evaluation?.questionEvals.find(e => e.questionId === q.id);

        return {
            questionIndex: idx,
            questionText: q.text,
            category: q.category,
            tips: (tipsData[q.id] as ExportQuestionPayload['tips']) || null,
            strongResponse: (strongResponseData[q.id] as ExportQuestionPayload['strongResponse']) || null,
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
            evaluation: questionEval ? {
                scores: questionEval.scores,
                notes: questionEval.notes,
            } : null,
        };
    });

    return {
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
        overallEvaluation: evaluation ? {
            score: evaluation.overallScore,
            notes: evaluation.overallNotes,
        } : null,
        questions,
    };
}

/**
 * Build a batch export payload from multiple sessions.
 */
export function buildBatchPayload(
    sessions: ExportSessionPayload[]
): ExportBatchPayload {
    return {
        exportedAt: new Date().toISOString(),
        rubricDefinition: EVAL_RUBRIC_DIMENSIONS,
        purpose: 'Evaluate candidate-facing content quality (hints, strong responses, feedback, next steps) to identify areas for improvement in the Interview Coach application.',
        sessions,
    };
}

/**
 * Trigger a JSON file download in the browser.
 */
function sanitizeDownloadFilename(filename: string) {
    const normalized = filename
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^\.+/, '')
        .replace(/^[-_.]+|[-_.]+$/g, '');

    if (!normalized) {
        return 'export.json';
    }

    return normalized.toLowerCase().endsWith('.json') ? normalized : `${normalized}.json`;
}

export function downloadJson(data: unknown, filename: string) {
    const safeFilename = sanitizeDownloadFilename(filename);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        // Use a download-only content type so exported data is not interpreted as active markup.
        type: 'application/octet-stream',
    });
    const url = URL.createObjectURL(blob);
    if (!url.startsWith('blob:')) {
        throw new Error('Unexpected download URL scheme.');
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
