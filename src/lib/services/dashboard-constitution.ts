/**
 * Dashboard Constitution Service
 *
 * Internal exploratory scaffold for a future interpretation layer.
 * This service is not part of the current recruiter product contract and
 * should be treated as dormant until a scoped readiness/signals feature returns.
 */

import { InterviewSession } from '@/lib/domain/types';

// --- Layer 2: Derived Metrics ---

interface CompetencyMetric {
    id: string;
    totalQuestions: number;
    attempted: number;
    strongSignals: number; // Internal calibration placeholder only.
}

export interface SessionMetrics {
    totalAnswers: number;
    completionRate: number;
    competencyProfile: Record<string, CompetencyMetric>;
    consistencyScore: number; // 0-1
}

export function computeMetrics(session: InterviewSession): SessionMetrics {
    const questions = session.questions;
    const answers = Object.values(session.answers);

    // Stub implementation
    return {
        totalAnswers: answers.length,
        completionRate: questions.length > 0 ? answers.length / questions.length : 0,
        competencyProfile: {},
        consistencyScore: 0.5 // Neutral default
    };
}

// --- Layer 3: Interpretive Signals ---

export enum SignalQuality {
    Insufficient = 'Insufficient',
    Emerging = 'Emerging',
    Reliable = 'Reliable',
    Strong = 'Strong'
}

export interface CoachingSignals {
    baseline: {
        text: string;
        quality: SignalQuality;
    };
    constellation: {
        strengths: string[];
        gaps: string[];
    };
    coachingFocus: {
        focus: string;
        rationale: string;
        action: string;
    };
}

export function generateSignals(session: InterviewSession, metrics: SessionMetrics): CoachingSignals {
    // 1. Determine Signal Quality
    let quality = SignalQuality.Insufficient;
    if (metrics.totalAnswers >= 1) quality = SignalQuality.Emerging;
    if (metrics.totalAnswers >= 3) quality = SignalQuality.Reliable;

    // 2. Generate Baseline
    let baselineText = "Based on limited recent practice, it appears you are just getting started.";
    if (quality === SignalQuality.Emerging) {
        baselineText = "Your recent answers suggest you are building a foundation.";
    } else if (quality === SignalQuality.Reliable) {
        baselineText = "Your answers are consistently demonstrating core competencies.";
    }

    // 3. Generate Focus (Stub Logic)
    return {
        baseline: {
            text: baselineText,
            quality
        },
        constellation: {
            strengths: [],
            gaps: []
        },
        coachingFocus: {
            focus: "Build Consistency",
            rationale: "You have started answering, but more data is needed to identify specific patterns.",
            action: "Complete at least 3 questions to unlock detailed insights."
        }
    };
}
