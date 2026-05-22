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
    name?: string;
    definition?: string;
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

export interface Question {
    id: string;
    text: string;
    category: string;
    framework?: string;
    competencyId?: string;
    difficulty?: string;
    index: number;
    tips?: QuestionTips;
}

export interface QuestionTips {
    doThis: string;
    avoidThis: string;
    __debugPrompt?: string;
}

export interface StrongResponseResult {
    strongResponse: string;
    whyThisWorks: string;
    __debugPrompt?: string;
}
export interface Answer {
    questionId: string;
    transcript?: string;
    modality?: 'text' | 'voice';
    audioUrl?: string;
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
    score: number;
    label: string;
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
    quote?: string;
}

export interface FeedbackSignalAssessment {
    valence: 'strength' | 'mixed' | 'growth';
    detectability: 'clear' | 'moderate' | 'ambiguous' | 'thin';
}

export interface FeedbackPrimaryAnchor {
    source: 'content' | 'delivery' | 'fallback';
    signalType: 'quote' | 'behavior' | 'pattern' | 'effort' | 'omission';
    dimension: Dimension;
    candidateEvidence: string;
    interviewerValue: string;
}

export interface FeedbackIntervention {
    type: 'amplify_strength' | 'sharpen_signal' | 'repair_foundation' | 'polish_response';
    reason: string;
}

export interface FeedbackPlan {
    centralRead: string;
    signal: FeedbackSignalAssessment;
    primaryAnchor: FeedbackPrimaryAnchor;
    intervention: FeedbackIntervention;
}

export interface OneBigUpgrade {
    focus: string;
    rationale: string;
    targetMoment?: string;
    trySayingThis: string;
}

export interface AnalysisResult {
    ack?: string;
    scores?: Record<Dimension, DimensionScore>;
    feedbackPlan?: FeedbackPlan;

    contentPulse?: CoachingPulse;
    deliveryPulse?: CoachingPulse;

    oneBigUpgrade?: OneBigUpgrade;

    nextAction?: {
        label: string;
        actionType: 'redo_answer' | 'next_question' | 'practice_example' | 'stop_for_now';
    };
    recommendation?: string;
    meta?: {
        tier: 0 | 1 | 2;
        modality: 'text' | 'voice';
        confidence?: 'low' | 'medium' | 'high';
        readinessLevel?: string;
    };

    transcript?: string;
    __debugPrompt?: string;

}
export interface InterviewSession {
    id: string;
    recruiterId?: string;
    candidateName?: string;
    role: string;
    jobDescription?: string;
    status: SessionStatus;
    summaryNarrative?: string | null;

    questions: Question[];
    currentQuestionIndex: number;
    answers: Record<string, Answer>;

    initialsRequired: boolean;
    enteredInitials?: string;
    coachingPreference?: 'tier0' | 'tier1' | 'tier2';

    candidate?: {
        firstName: string;
        lastName: string;
        email: string;
        resumeText?: string;
    };
    inviteToken?: string;
    viewedAt?: number;
    updatedAt?: number;
    summaryExpiresAt?: number;
    summaryExpired?: boolean;
    engagedTimeSeconds?: number;
    engagedTimeDelta?: number;
    intakeData?: Record<string, unknown>;

    parentSessionId?: string;
    attemptNumber?: number;
    clientName?: string;
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
