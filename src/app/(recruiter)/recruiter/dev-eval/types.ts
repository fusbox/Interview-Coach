/**
 * Dev Evaluation Module - Internal Types & Rubric
 *
 * Used only by the internal developer evaluation workspace to score
 * candidate sessions and export structured data for analysis.
 * This module is intentionally not part of the recruiter-facing product contract.
 */

export const EVAL_RUBRIC_DIMENSIONS = [
    {
        id: "hints_quality",
        label: "Hints Quality",
        description: "Are the tips or hints useful, specific, and actionable for this question and role?"
    },
    {
        id: "response_example_quality",
        label: "Response Example Quality",
        description: "Is the strong response realistic, relevant, well-structured, and appropriately calibrated?"
    },
    {
        id: "feedback_accuracy",
        label: "Feedback Accuracy",
        description: "Does the AI feedback correctly identify strengths and weaknesses in the answer?"
    },
    {
        id: "feedback_actionability",
        label: "Feedback Actionability",
        description: "Is the recommended next step clear, specific, and useful to the candidate?"
    },
    {
        id: "reading_level_fit",
        label: "Reading Level Fit",
        description: "Is the language appropriately calibrated for the role level (entry-level vs senior)?"
    },
    {
        id: "readiness_level_accuracy",
        label: "Internal Calibration Band Accuracy",
        description: "For internal review only: does the hidden readiness band (RL1-RL4) align with the evidence in the candidate response?"
    },
    {
        id: "overall_quality",
        label: "Overall Session Quality",
        description: "Holistic rating of the entire session experience for this question."
    }
] as const;

export type EvalDimensionId = (typeof EVAL_RUBRIC_DIMENSIONS)[number]["id"];

export interface EvalRubricScore {
    dimension: EvalDimensionId;
    score: number;
    comment: string;
}

export interface QuestionEval {
    questionId: string;
    scores: EvalRubricScore[];
    notes: string;
}

export interface SessionEval {
    sessionId: string;
    evaluatedAt: number;
    overallScore: number;
    overallNotes: string;
    questionEvals: QuestionEval[];
}

export interface ExportQuestionPayload {
    questionIndex: number;
    questionText: string;
    category: string;
    tips?: {
        lookingFor: string;
        pointsToCover: string[];
        answerFramework: string;
        industrySpecifics: { metrics: string; tools: string };
        mistakesToAvoid: string[];
        proTip: string;
    } | null;
    strongResponse?: {
        strongResponse: string;
        whyThisWorks: {
            lookingFor: string;
            pointsToCover: string[];
            answerFramework: string;
            industrySpecifics: { metrics: string; tools: string };
            mistakesToAvoid: string[];
            proTip: string;
        };
    } | null;
    candidateTranscript?: string;
    submittedAt?: number;
    feedback?: {
        ack?: string;
        feedbackPlan?: {
            centralRead: string;
            signal: {
                valence: string;
                detectability: string;
            };
            primaryAnchor: {
                source: string;
                signalType: string;
                dimension: string;
                candidateEvidence: string;
                interviewerValue: string;
            };
            intervention: {
                type: string;
                reason: string;
            };
        };
        contentPulse?: {
            headline: string;
            body: string;
            quote?: string;
        };
        deliveryPulse?: {
            headline: string;
            body: string;
        };
        nextAction?: {
            label: string;
            actionType: string;
        };
        meta?: {
            tier: number;
            modality: string;
            confidence?: string;
            readinessLevel?: string;
        };
    } | null;
    evaluation?: {
        scores: EvalRubricScore[];
        notes: string;
    } | null;
}

export interface ExportSessionPayload {
    exportedAt: string;
    rubricDefinition: typeof EVAL_RUBRIC_DIMENSIONS;
    session: {
        id: string;
        candidateName: string;
        role: string;
        jobDescription?: string;
        status: string;
        questionCount: number;
        answerCount: number;
    };
    overallEvaluation: {
        score: number;
        notes: string;
    } | null;
    questions: ExportQuestionPayload[];
}

export interface ExportBatchPayload {
    exportedAt: string;
    rubricDefinition: typeof EVAL_RUBRIC_DIMENSIONS;
    purpose: string;
    sessions: ExportSessionPayload[];
}
