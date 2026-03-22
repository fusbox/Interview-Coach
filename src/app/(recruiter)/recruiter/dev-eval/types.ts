/**
 * Dev Evaluation Module — Types & Rubric
 * 
 * Used by the developer evaluation workspace to score
 * candidate sessions and export structured data for LLM analysis.
 */

// ─── Rubric Dimensions ──────────────────────────────────────────

export const EVAL_RUBRIC_DIMENSIONS = [
    {
        id: 'hints_quality',
        label: 'Hints Quality',
        description: 'Are the tips/hints useful, specific, and actionable for this question and role?'
    },
    {
        id: 'response_example_quality',
        label: 'Response Example Quality',
        description: 'Is the strong response realistic, relevant, well-structured, and appropriately calibrated?'
    },
    {
        id: 'feedback_accuracy',
        label: 'Feedback Accuracy',
        description: 'Does the AI feedback correctly identify strengths and weaknesses in the answer?'
    },
    {
        id: 'feedback_actionability',
        label: 'Feedback Actionability',
        description: 'Is the recommended next step clear, specific, and useful to the candidate?'
    },
    {
        id: 'reading_level_fit',
        label: 'Reading Level Fit',
        description: 'Is the language appropriately calibrated for the role level (entry-level vs senior)?'
    },
    {
        id: 'readiness_level_accuracy',
        label: 'Readiness Level Accuracy',
        description: 'Does the assigned Readiness Level (RL1-RL4) accurately reflect the candidate’s performance based on the evidence?'
    },
    {
        id: 'overall_quality',
        label: 'Overall Session Quality',
        description: 'Holistic rating of the entire session experience for this question.'
    },
] as const;

export type EvalDimensionId = typeof EVAL_RUBRIC_DIMENSIONS[number]['id'];

// ─── Scoring Types ──────────────────────────────────────────────

export interface EvalRubricScore {
    dimension: EvalDimensionId;
    score: number; // 1-5
    comment: string;
}

export interface QuestionEval {
    questionId: string;
    scores: EvalRubricScore[];
    notes: string;
}

export interface SessionEval {
    sessionId: string;
    evaluatedAt: number; // timestamp
    overallScore: number; // 1-5
    overallNotes: string;
    questionEvals: QuestionEval[];
}

// ─── Export Payload ──────────────────────────────────────────────

export interface ExportQuestionPayload {
    questionIndex: number;
    questionText: string;
    category: string;
    // Candidate-facing content
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
    // Candidate answer
    candidateTranscript?: string;
    submittedAt?: number;
    // AI feedback
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
    // Evaluator scores
    evaluation?: {
        scores: EvalRubricScore[];
        notes: string;
    } | null;
}

export interface ExportSessionPayload {
    exportedAt: string; // ISO timestamp
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
