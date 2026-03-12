import { z } from 'zod';
import { FEEDBACK_DIMENSIONS } from '../constants';

// --- Domain Entity Schemas ---

export const SessionStatusSchema = z.enum([
    'NOT_STARTED',
    'GENERATING_QUESTIONS',
    'IN_SESSION',
    'AWAITING_EVALUATION',
    'REVIEWING',
    'PAUSED',
    'COMPLETED',
    'ERROR',
]);

export const QuestionTipsSchema = z.object({
    doThis: z.string(),
    avoidThis: z.string(),
});

export const QuestionSchema = z.object({
    id: z.string(),
    text: z.string(),
    category: z.string(),
    framework: z.string().optional(),
    competencyId: z.string().optional(),
    difficulty: z.string().optional(),
    index: z.number(),
    tips: QuestionTipsSchema.optional(),
});

export const DimensionSchema = z.enum(FEEDBACK_DIMENSIONS);

export const DimensionScoreSchema = z.object({
    score: z.number().min(1).max(5),
    label: z.string()
});

export const TaggedObservationSchema = z.object({
    text: z.string(),
    dimension: DimensionSchema,
    type: z.enum(['strength', 'growth']),
    quote: z.string().optional()
});

export const CoachingPulseSchema = z.object({
    dimension: DimensionSchema,
    headline: z.string(),
    body: z.string(),
    quote: z.string().optional()
});

export const AnalysisResultSchema = z.object({
    ack: z.string().optional(),
    scores: z.record(DimensionSchema, DimensionScoreSchema).optional(),

    contentPulse: CoachingPulseSchema.optional(),
    deliveryPulse: CoachingPulseSchema.optional(),

    nextAction: z.object({
        label: z.string(),
        actionType: z.enum(['redo_answer', 'next_question', 'practice_example', 'stop_for_now']),
    }).optional(),
    meta: z.object({
        tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        modality: z.enum(['text', 'voice']),
        signalQuality: z.enum(['insufficient', 'emerging', 'reliable', 'strong']).optional(),
        confidence: z.enum(['low', 'medium', 'high']).optional(),
        readinessLevel: z.enum(['RL1', 'RL2', 'RL3', 'RL4']).optional(),
    }).optional(),
    transcript: z.string().optional(),
    readinessBand: z.enum(['RL1', 'RL2', 'RL3', 'RL4']).optional(),
    coachReaction: z.string().optional(),
}).passthrough();

export const AnswerSchema = z.object({
    questionId: z.string(),
    transcript: z.string().optional(),
    audioUrl: z.string().optional(),
    submittedAt: z.number().optional(),
    analysis: AnalysisResultSchema.optional(),
    draft: z.string().optional(),
    retryContext: z.object({
        trigger: z.enum(['user', 'coach']),
        focus: z.string().optional(),
    }).optional(),
});

export const InterviewSessionSchema = z.object({
    id: z.string(),
    candidateName: z.string().nullish().transform(v => v ?? undefined),
    role: z.string(),
    jobDescription: z.string().nullish().transform(v => v ?? undefined),
    status: SessionStatusSchema,
    readinessBand: z.string().nullish().transform(v => v ?? undefined),
    summaryNarrative: z.string().nullish().transform(v => v ?? undefined),
    questions: z.array(QuestionSchema),
    currentQuestionIndex: z.number(),
    answers: z.record(z.string(), AnswerSchema),
    initialsRequired: z.boolean(),
    enteredInitials: z.string().nullish().transform(v => v ?? undefined),
    coachingPreference: z.enum(['tier0', 'tier1', 'tier2']).nullish().transform(v => v ?? undefined),
    candidate: z.object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string(),
        resumeText: z.string().optional(),
    }).passthrough().optional(),
    engagedTimeSeconds: z.number().nullish().transform(v => v ?? undefined),
    parentSessionId: z.string().uuid().nullish().transform(v => v ?? undefined),
    attemptNumber: z.number().int().min(1).nullish().transform(v => v ?? undefined),
    clientName: z.string().nullish().transform(v => v ?? undefined),
});

export const IntakeDataSchema = z
    .object({
        confidenceScore: z.number().int().min(1).max(5).optional(),
        biggestStruggle: z.string().optional(),
        challengeLevel: z.enum(['warm_up', 'realistic', 'challenge']).optional(),
        primaryGoal: z.string().optional(),
        stage: z.string().optional(),
        mustPracticeQuestions: z.array(z.string()).optional(),
        resumeText: z.string().optional(),
    })
    .passthrough()
    .optional();

export const InitSessionSchema = z.object({
    role: z.string().min(1, 'Role is required'),
    jobDescription: z.string().optional(),
    intakeData: IntakeDataSchema,
    parentId: z.string().uuid().optional(),
});

export const UpdateSessionSchema = z.object({
    status: SessionStatusSchema.optional(),
    readinessBand: z.string().optional(),
    summaryNarrative: z.string().optional(),
    currentQuestionIndex: z.number().int().min(0).optional(),
    role: z.string().min(1).optional(),
    jobDescription: z.string().optional(),
    enteredInitials: z.string().min(1).optional(),
    initialsRequired: z.boolean().optional(),
    coachingPreference: z.enum(['tier0', 'tier1', 'tier2']).optional(),
    engagedTimeSeconds: z.number().int().min(0).optional(),
    parentSessionId: z.string().uuid().nullish().transform(v => v ?? undefined),
    attemptNumber: z.number().int().min(1).nullish().transform(v => v ?? undefined),
    clientName: z.string().nullish().transform(v => v ?? undefined),
    engagedTimeDelta: z.number().int().min(0).optional(),
}).strict();

// QuestionPlan schema (minimal validation for structural integrity)
export const QuestionPlanSchema = z
    .object({
        questions: z.array(
            z.object({
                id: z.string(),
                competencyId: z.string().optional(),
                type: z.string().optional(),
                difficulty: z.string().optional(),
                intent: z.string().optional(),
            })
        ),
    })
    .optional();

// Blueprint schema 
export const BlueprintSchema = z
    .object({
        role: z
            .object({
                title: z.string().optional(),
                seniority: z.string().optional(),
            })
            .optional(),
        readingLevel: z
            .object({
                mode: z.string(),
                maxSentenceWords: z.number(),
                avoidJargon: z.boolean(),
            })
            .optional(),
        scoringModel: z
            .object({
                dimensions: z.array(z.any()).optional(),
                ratingBands: z.any().optional(),
            })
            .optional()
            .or(z.any()), // Allow loose structure for complex nested objects
        competencies: z
            .array(
                z.object({
                    id: z.string(),
                    name: z.string(),
                    definition: z.string(),
                })
            )
            .optional(),
    })
    .passthrough()
    .optional();

export const CoachPrepSchema = z.object({
    role: z.string().min(1, 'Role is required'),
    jobDescription: z.string().optional(),
});

export const GenerateTipsSchema = z.object({
    question: z.string().min(1, 'Question is required'),
    role: z.string().min(1, 'Role is required'),
    competency: z.any().optional(), // Flexible for now
    intakeData: IntakeDataSchema,
    blueprint: BlueprintSchema,
});

export const GenerateStrongResponseSchema = z.object({
    question: z.string().min(1, 'Question is required'),
    role: z.string().optional()
});

export const GenerateBlueprintSchema = z.object({
    role: z.string().min(1, 'Role is required'),
    jobDescription: z.string().optional(),
    seniority: z.string().optional(),
});

export const GenerateQuestionPlanSchema = z.object({
    blueprint: BlueprintSchema.unwrap(), // Logic requires blueprint to be present
});

export const GenerateQuestionsSchema = z.object({
    role: z.string().min(1, 'Role is required'),
    jobDescription: z.string().optional(),
    questionPlan: QuestionPlanSchema,
    blueprint: BlueprintSchema,
    subsetIndices: z.array(z.number()).optional(),
    intakeData: IntakeDataSchema,
});

export const AnalyzeAnswerSchema = z.object({
    question: z.string().min(1, 'Question is required'),
    input: z.union([
        z.string().min(1), // Text input
        z.object({
            // Audio input
            data: z.string().min(1),
            mimeType: z.string().optional(),
        }),
    ]),
    blueprint: BlueprintSchema,
    questionId: z.string().optional(),
    intakeData: IntakeDataSchema,
});
