export const STORAGE_KEYS = {
    CURRENT_SESSION_ID: "current_session_id",
} as const;

export const API_HEADERS = {
    CANDIDATE_TOKEN: "x-candidate-token",
} as const;

export const SESSION_STATUS = {
    NOT_STARTED: 'NOT_STARTED',
    GENERATING_QUESTIONS: 'GENERATING_QUESTIONS',
    IN_SESSION: 'IN_SESSION',
    AWAITING_EVALUATION: 'AWAITING_EVALUATION',
    REVIEWING: 'REVIEWING',
    PAUSED: 'PAUSED',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR',
} as const;

export const FEEDBACK_DIMENSIONS = [
    'structural_clarity',
    'outcome_explicitness',
    'specificity_concreteness',
    'decision_rationale',
    'focus_relevance',
    'pace',
    'energy',
    'clarity',
    'confidence'
] as const;

export type Dimension = typeof FEEDBACK_DIMENSIONS[number];
