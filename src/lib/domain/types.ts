export type SessionStatus =
    | 'NOT_STARTED'
    | 'GENERATING_QUESTIONS'
    | 'IN_SESSION'
    | 'AWAITING_EVALUATION'
    | 'REVIEWING'
    | 'PAUSED'
    | 'COMPLETED'
    | 'ERROR';

export interface Competency {
    id: string;
    title: string;
    description: string;
    name?: string; // Compatibility alias for title
    definition?: string; // Compatibility alias for description
}

export interface Blueprint {
    title: string;
    competencies: Competency[];
    readingLevel?: {
        mode?: string;
        maxSentenceWords?: number;
        avoidJargon?: boolean;
    };
}

/**
 * Canonical Question Entity
 */
export interface Question {
    id: string;
    text: string;
    category: string; // e.g. "Behavioral", "Technical"
    framework?: string; // e.g. "STAR", "Problem-Solving"
    competencyId?: string;
    difficulty?: string;
    index: number; // 0-based index
    tips?: QuestionTips;
}

export interface QuestionTips {
    doThis: string;    // 1-2 sentences: the key differentiator action
    avoidThis: string; // 1-2 sentences: the most common trap
    __debugPrompt?: string; // Captured LLM payload for runtime AI introspection
}

export interface StrongResponseResult {
    strongResponse: string;
    whyThisWorks: string;
    __debugPrompt?: string; // Captured LLM payload for runtime AI introspection
}

/**
 * Canonical Answer Entity
 */
export interface Answer {
    questionId: string;
    transcript?: string; // Final text
    audioUrl?: string; // Optional audio ref
    submittedAt?: number;
    analysis?: AnalysisResult;
    draft?: string;
    retryContext?: {
        trigger: 'user' | 'coach';
        focus?: string;
    };
}

import { Dimension } from '../constants';
export type { Dimension };

export interface DimensionScore {
    score: number; // 1-5
    label: string; // The LLM's brief reasoning for this specific score
}

export interface TaggedObservation {
    text: string;
    dimension: Dimension;
    type: 'strength' | 'growth';
    quote?: string;
}

export interface CoachingPulse {
    dimension: Dimension;
    headline: string;
    body: string;
    quote?: string; // Required for content, forbidden for delivery (prompt enforced)
}

/**
 * Analysis Result (Model Output)
 */
export interface AnalysisResult {
    // New Feedback Schema V2
    ack?: string;
    scores?: Record<Dimension, DimensionScore>;

    // The "Pulse" (In-Session High-Impact Coaching)
    contentPulse?: CoachingPulse;
    deliveryPulse?: CoachingPulse; // Optional: Only triggered on exception (high/low signal)

    nextAction?: {
        label: string;
        actionType: 'redo_answer' | 'next_question' | 'practice_example' | 'stop_for_now';
    };
    recommendation?: string; // Narrative summary for the "Next Step" slide
    meta?: {
        tier: 0 | 1 | 2;
        modality: 'text' | 'voice';
        signalQuality?: 'insufficient' | 'emerging' | 'reliable' | 'strong';
        confidence?: 'low' | 'medium' | 'high';
        readinessLevel?: string; // RL1..RL4
    };

    transcript?: string;
    __debugPrompt?: string; // Captured LLM payload for runtime AI introspection

    readinessBand?: 'RL1' | 'RL2' | 'RL3' | 'RL4';
    coachReaction?: string;
}

/**
 * Canonical Interview Session
 */
export interface InterviewSession {
    id: string;
    recruiterId?: string; // Added for ownership check
    candidateName?: string;
    role: string;
    jobDescription?: string;
    status: SessionStatus;
    readinessBand?: string | null;
    summaryNarrative?: string | null;

    // The Data
    questions: Question[];
    currentQuestionIndex: number;
    answers: Record<string, Answer>; // Keyed by questionId

    // Minimal config truth
    initialsRequired: boolean;
    enteredInitials?: string;
    coachingPreference?: 'tier0' | 'tier1' | 'tier2';

    // Identity
    candidate?: {
        firstName: string;
        lastName: string;
        email: string;
        resumeText?: string;
    };
    inviteToken?: string; // Persisted plain token for "Copy Link"
    viewedAt?: number;
    updatedAt?: number;
    engagedTimeSeconds?: number;
    engagedTimeDelta?: number;
    intakeData?: Record<string, unknown>; // Full intake JSON for context

    // Lineage & Metadata
    parentSessionId?: string;
    attemptNumber?: number; // 1-based index (default 1)
    clientName?: string; // For future filtering
}

export interface SessionSummary {
    id: string;
    candidateName: string;
    role: string;
    status: SessionStatus;
    createdAt: number;
    questionCount: number;
    answerCount: number;
    submittedCount: number;
    viewedAt?: number;
    updatedAt?: number;
    enteredInitials?: string;
    inviteToken?: string;
    invitationSentAt?: number;
    parentSessionId?: string;
    attemptNumber?: number;
    clientName?: string;
    attempts?: SessionSummary[];
    candidateEmail?: string;
    candidateFirstName?: string;
    candidateLastName?: string;
    engagedTimeSeconds?: number;
}

export interface SessionDashboardMetrics {
    totalInvites: number;
    activeSessions: number;
    completedSessions: number;
    stalledSessions: number;
    averageEngagementTimeSeconds: number;
}
