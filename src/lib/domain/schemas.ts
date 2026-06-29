import { z } from 'zod';
import { FEEDBACK_DIMENSIONS } from '../constants';

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

export const StrongResponseResultSchema = z.object({
    strongResponse: z.string().min(1),
    whyThisWorks: z.string().min(1),
});

const GeneratedQuestionObjectSchema = z.record(z.string().min(1), z.string().min(1));

export const GeneratedInterviewQuestionsSchema = z.object({
    behavioral: GeneratedQuestionObjectSchema.default({}),
    caseScenario: GeneratedQuestionObjectSchema.default({}),
    culture: GeneratedQuestionObjectSchema.default({}),
    technical: z.array(
        z.object({
            text: z.string().min(1),
        })
    ).max(20).default([]),
    screening: GeneratedQuestionObjectSchema.default({}),
}).superRefine((value, ctx) => {
    const questionCount = Object.keys(value.behavioral).length
        + Object.keys(value.caseScenario).length
        + Object.keys(value.culture).length
        + value.technical.length
        + Object.keys(value.screening).length;

    if (questionCount === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "At least one generated question is required",
            path: ["behavioral"],
        });
    }
});

export const SmtpEmailSendResultSchema = z.object({
    messageId: z.string().min(1),
    accepted: z.array(z.string()).optional(),
    rejected: z.array(z.string()).optional(),
    pending: z.array(z.string()).optional(),
    response: z.string().optional(),
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

export const DimensionScoreApplicabilitySchema = z.enum([
    'observed',
    'not_elicited',
    'insufficient_data',
    'unscoreable',
]);

export const DimensionScoreSchema = z.object({
    applicability: DimensionScoreApplicabilitySchema.optional(),
    score: z.number().min(1).max(5).optional(),
    label: z.string()
}).superRefine((value, ctx) => {
    if ((value.applicability === undefined || value.applicability === 'observed') && value.score === undefined) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Observed dimension scores require a numeric score",
            path: ["score"],
        });
    }
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

export const FeedbackSignalAssessmentSchema = z.object({
    valence: z.enum(['strength', 'mixed', 'growth']),
    detectability: z.enum(['clear', 'moderate', 'ambiguous', 'thin']),
});

export const FeedbackPrimaryAnchorSchema = z.object({
    source: z.enum(['content', 'delivery', 'fallback']),
    signalType: z.enum(['quote', 'behavior', 'pattern', 'effort', 'omission']),
    dimension: DimensionSchema,
    candidateEvidence: z.string(),
    interviewerValue: z.string(),
});

export const FeedbackInterventionSchema = z.object({
    type: z.enum(['amplify_strength', 'sharpen_signal', 'repair_foundation', 'polish_response']),
    reason: z.string(),
});

export const FeedbackPlanSchema = z.object({
    centralRead: z.string(),
    signal: FeedbackSignalAssessmentSchema,
    primaryAnchor: FeedbackPrimaryAnchorSchema,
    intervention: FeedbackInterventionSchema,
});

export const CoachSignalSchema = z.object({
    focus: z.string(),
    rationale: z.string(),
    targetMoment: z.string().optional(),
    trySayingThis: z.string(),
});

export const OneBigUpgradeSchema = CoachSignalSchema;

export const AnalysisResultSchema = z.object({
    ack: z.string().optional(),
    scores: z.record(DimensionSchema, DimensionScoreSchema).optional(),
    feedbackPlan: FeedbackPlanSchema.optional(),

    contentPulse: CoachingPulseSchema.optional(),
    deliveryPulse: CoachingPulseSchema.optional(),

    coachSignal: CoachSignalSchema.optional(),
    oneBigUpgrade: OneBigUpgradeSchema.optional(),

    nextAction: z.object({
        label: z.string(),
        actionType: z.enum(['redo_answer', 'next_question', 'practice_example', 'stop_for_now']),
    }).optional(),
    meta: z.object({
        tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        modality: z.enum(['text', 'voice']),
        confidence: z.enum(['low', 'medium', 'high']).optional(),
        readinessLevel: z.enum(['RL1', 'RL2', 'RL3', 'RL4']).optional(),
    }).optional(),
    transcript: z.string().optional(),
}).passthrough();

export const AnswerSchema = z.object({
    questionId: z.string(),
    transcript: z.string().optional(),
    modality: z.enum(['text', 'voice']).optional(),
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
    summaryExpiresAt: z.number().nullish().transform(v => v ?? undefined),
    summaryExpired: z.boolean().optional(),
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

export const CompetencySchema = z
    .object({
        id: z.string().optional(),
        name: z.string().optional(),
        definition: z.string().optional(),
    })
    .passthrough();

export const ScoringDimensionSchema = z
    .object({
        id: z.string().optional(),
        name: z.string().optional(),
        label: z.string().optional(),
        description: z.string().optional(),
    })
    .passthrough();

export const RatingBandSchema = z
    .object({
        label: z.string().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        description: z.string().optional(),
    })
    .passthrough();

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
                dimensions: z.array(ScoringDimensionSchema).optional(),
                ratingBands: z.array(RatingBandSchema).optional(),
            })
            .passthrough()
            .optional(),
        competencies: z
            .array(CompetencySchema)
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
    competency: CompetencySchema.optional(),
    resumeText: z.string().optional(),
    intakeData: IntakeDataSchema,
    blueprint: BlueprintSchema,
});

export const GenerateTipsRequestSchema = GenerateTipsSchema.extend({
    sessionId: z.string().min(1, "Session is required"),
});

export const GenerateStrongResponseSchema = z.object({
    question: z.string().min(1, 'Question is required'),
    role: z.string().optional()
});

export const GenerateStrongResponseRequestSchema = GenerateStrongResponseSchema.extend({
    resumeText: z.string().optional(),
    sessionId: z.string().min(1, 'Session is required'),
});

export const GenerateBlueprintSchema = z.object({
    role: z.string().min(1, 'Role is required'),
    jobDescription: z.string().optional(),
    seniority: z.string().optional(),
});

export const GenerateQuestionsRequestSchema = z.object({
    role: z.string().trim().min(1, "Role is required"),
    jobDescription: z.string().trim().optional(),
    resume: z.string().trim().optional(),
    interviewStage: z.enum(["not_sure", "initial_screening", "initial_interview", "follow_up_final", "practice_only"]).optional(),
    questionCount: z.number().int().min(1).max(20).optional(),
});

export const InviteSendRequestSchema = z.object({
    recipientEmail: z.string().email().optional(),
    recipientEmails: z.array(z.string().email()).max(50).optional(),
    recipientFirstName: z.string().trim().min(1),
    role: z.string().trim().min(1),
    inviteLink: z.string().url(),
    recruiterName: z.string().trim().min(1),
    recruiterTitle: z.string().trim().optional(),
    recruiterCompany: z.string().trim().optional(),
    recruiterPhone: z.string().trim().optional(),
    recruiterEmail: z.string().email().optional(),
    sessionIds: z.array(z.string().min(1)).max(50).optional()
}).superRefine((value, ctx) => {
    const direct = value.recipientEmail ? [value.recipientEmail] : [];
    const fromArray = value.recipientEmails || [];
    if (direct.length + fromArray.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one recipient email is required" });
    }
});

export const InviteResendRequestSchema = z.object({
    sessionId: z.string().min(1),
    recruiterName: z.string().trim().min(1),
    recruiterTitle: z.string().trim().optional(),
    recruiterCompany: z.string().trim().optional(),
    recruiterPhone: z.string().trim().optional(),
    recruiterEmail: z.string().email().optional(),
});

export const CreateInviteCandidateSchema = z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.string().email(),
    reqId: z.string().trim().min(1),
    resumeText: z.string().optional(),
});

export const CreateInviteQuestionSchema = z.object({
    text: z.string().trim().min(1),
    category: z.string().trim().min(1),
    index: z.number().int().min(0),
});

export const CreateInviteRequestSchema = z.object({
    role: z.string().trim().min(1),
    jobDescription: z.string().optional(),
    candidates: z.array(CreateInviteCandidateSchema).min(1).max(50),
    questions: z.array(CreateInviteQuestionSchema).min(1),
});

export const TtsRequestSchema = z.object({
    text: z.string().trim().min(1, "Missing text"),
});

export const GenerateQuestionPlanSchema = z.object({
    blueprint: BlueprintSchema.unwrap(),
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
        z.string().min(1),
        z.object({
            data: z.string().min(1),
            mimeType: z.string().optional(),
        }),
    ]),
    blueprint: BlueprintSchema,
    questionId: z.string().optional(),
    intakeData: IntakeDataSchema,
});

export const AnalyzeAnswerRequestSchema = AnalyzeAnswerSchema.extend({
    sessionId: z.string().min(1, "Session is required"),
});

export const QuestionRetryRequestSchema = z.object({
    retryContext: z.object({
        trigger: z.enum(["user", "coach"]),
        focus: z.string().optional(),
    }).optional(),
});

export const QuestionAnalysisRequestSchema = z.object({
    audioData: z.object({
        base64: z.string().min(1),
        mimeType: z.string().min(1),
    }).nullable().optional(),
});

export const SubmitAnswerRequestSchema = z.object({
    text: z.string(),
    modality: z.enum(['text', 'voice']).optional().default('text'),
    analysis: AnalysisResultSchema.optional(),
});
