import {
    createEvidenceFirstEvaluationCase,
    type EvidenceFirstEvaluationCase,
    type EvidenceExtractionOutput,
    type FeedbackCompositionOutput,
    type UniversalCriterionId,
} from "./evidence-first-evaluator-contract";

export const CANDIDATE_EVALUATOR_GOLDEN_SUITE_VERSION = "candidate_evaluator_golden_v1" as const;

type ObservableMarker = keyof EvidenceExtractionOutput["observableMarkers"];
type SensitiveContentFlag = EvidenceExtractionOutput["sensitiveContentFlags"][number];
type AnswerUsability = EvidenceExtractionOutput["answerUsability"]["status"];
type TechnicalAccuracy = EvidenceExtractionOutput["technicalAccuracy"]["status"];
type Intervention = FeedbackCompositionOutput["feedbackPlan"]["intervention"];

export type CandidateEvaluatorGoldenExpectation = {
    allowedUsability: readonly AnswerUsability[];
    markerValues?: Partial<Record<ObservableMarker, boolean>>;
    requiredSensitiveFlags?: readonly SensitiveContentFlag[];
    technicalAccuracy?: TechnicalAccuracy;
    verificationRequired?: boolean;
    allowedInterventions?: readonly Intervention[];
    criterionBands?: Partial<Record<UniversalCriterionId, readonly ("emerging" | "clear" | "strong")[]>>;
    primaryStrength?: "present" | "absent";
    deliveryNote?: "present" | "absent";
};

export type CandidateEvaluatorGoldenCase = {
    caseId: string;
    title: string;
    evaluationCase: EvidenceFirstEvaluationCase;
    expectation: CandidateEvaluatorGoldenExpectation;
    fairnessPair?: {
        pairId: "strong_content_modality_pair";
        variant: "typed" | "voice";
    };
};

const submittedAt = "2026-07-16T12:00:00.000Z";

const warehouseRoleContext = {
    targetRole: "Warehouse Associate",
    interviewStage: "screening" as const,
    jobDescription: "Receive shipments, organize inventory, follow safety procedures, and communicate clearly with the warehouse team.",
    resumeText: null,
};

const customerServiceRoleContext = {
    targetRole: "Customer Service Representative",
    interviewStage: "first_interview" as const,
    jobDescription: "Help customers resolve account questions, document each interaction, follow policy, and escalate issues when needed.",
    resumeText: null,
};

const entryLevelRoleContext = {
    targetRole: "Operations Assistant",
    interviewStage: "first_interview" as const,
    jobDescription: "Coordinate routine tasks, communicate progress, organize records, and learn new processes with guidance.",
    resumeText: "Student project experience coordinating group assignments and maintaining shared schedules.",
};

const inventoryRoleContext = {
    targetRole: "Inventory Control Associate",
    interviewStage: "follow_up" as const,
    jobDescription: "Investigate inventory differences, maintain accurate records, coordinate recounts, and improve repeatable stock processes.",
    resumeText: "Three years of inventory receiving, cycle counts, discrepancy research, and shift handoffs.",
};

const databaseRoleContext = {
    targetRole: "Database Support Specialist",
    interviewStage: "first_interview" as const,
    jobDescription: "Support relational databases, investigate query performance, document changes, and explain operational tradeoffs.",
    resumeText: null,
};

const inventoryAnswer = "During three weekly cycle counts, the same parts were short in the system even though they were on the shelf. I compared receiving logs with bin transfers and found that night-shift moves were not being recorded. I created a one-page transfer check, walked both shifts through it, and reviewed the exceptions each morning for two weeks. The recurring variance fell from about twelve items per count to one, and the team kept using the check after the trial.";

export const candidateEvaluatorGoldenCases: readonly CandidateEvaluatorGoldenCase[] = [
    createGoldenCase({
        caseId: "thin_screening_answer",
        title: "Thin answer",
        question: {
            category: "screening",
            questionText: "What interests you about this warehouse associate role?",
            plannedPurpose: "Understand the candidate's interest and role connection.",
        },
        answer: {
            mode: "text",
            text: "I work hard.",
        },
        roleContext: warehouseRoleContext,
        expectation: {
            allowedUsability: ["thin"],
            markerValues: { isVeryShort: true },
            allowedInterventions: ["revise_answer", "build_missing_signal"],
            primaryStrength: "absent",
        },
    }),
    createGoldenCase({
        caseId: "polished_off_topic_answer",
        title: "Polished but off-topic answer",
        question: {
            category: "behavioral",
            questionText: "Tell me about a time you calmed an upset customer.",
            plannedPurpose: "Look for de-escalation, ownership, and follow-through.",
        },
        answer: {
            mode: "text",
            text: "I have always admired companies with strong branding and modern offices. I enjoy learning about new products, and I am excited about opportunities to grow with a respected organization.",
        },
        roleContext: customerServiceRoleContext,
        expectation: {
            allowedUsability: ["off_topic", "non_answer"],
            markerValues: { answeredQuestion: false },
            allowedInterventions: ["revise_answer", "build_missing_signal"],
            primaryStrength: "absent",
        },
    }),
    createGoldenCase({
        caseId: "sensitive_health_disclosure",
        title: "Sensitive disclosure",
        question: {
            category: "screening",
            questionText: "Why did you leave your last role?",
            plannedPurpose: "Understand the transition using a concise professional boundary.",
        },
        answer: {
            mode: "text",
            text: "I left because I had a medical issue and my manager treated me unfairly while I was receiving treatment.",
        },
        roleContext: customerServiceRoleContext,
        expectation: {
            allowedUsability: ["sensitive_disclosure"],
            requiredSensitiveFlags: ["health_or_disability_disclosure"],
            allowedInterventions: ["professional_reframe"],
        },
    }),
    createGoldenCase({
        caseId: "transferable_school_leadership",
        title: "Transferable experience",
        question: {
            category: "behavioral",
            questionText: "Tell me about a time you led a project.",
            plannedPurpose: "Look for ownership, coordination, and a concrete result.",
        },
        answer: {
            mode: "text",
            text: "I have not formally led a project at work, but in school I coordinated a four-person research assignment. I divided the work around everyone's availability, checked progress twice a week, and combined our sections into one consistent presentation. We submitted it on time and earned one of the highest grades in the class.",
        },
        roleContext: entryLevelRoleContext,
        expectation: {
            allowedUsability: ["usable"],
            markerValues: {
                answeredQuestion: true,
                hasExample: true,
                hasPersonalAction: true,
                hasOutcomeOrTakeaway: true,
            },
            criterionBands: {
                answer_focus: ["clear", "strong"],
                evidence_specificity: ["clear", "strong"],
                role_skill_signal: ["clear", "strong"],
            },
            allowedInterventions: ["affirm_and_continue", "polish_then_continue"],
            primaryStrength: "present",
        },
    }),
    createGoldenCase({
        caseId: "strong_content_typed",
        title: "Strong content typed baseline",
        question: {
            category: "behavioral",
            questionText: "Tell me about a time you fixed a recurring inventory problem.",
            plannedPurpose: "Look for diagnosis, ownership, action, and measurable follow-through.",
        },
        answer: {
            mode: "text",
            text: inventoryAnswer,
        },
        roleContext: inventoryRoleContext,
        expectation: {
            allowedUsability: ["usable"],
            markerValues: {
                answeredQuestion: true,
                hasExample: true,
                hasPersonalAction: true,
                hasOutcomeOrTakeaway: true,
            },
            allowedInterventions: ["affirm_and_continue", "polish_then_continue"],
            primaryStrength: "present",
            deliveryNote: "absent",
        },
        fairnessPair: { pairId: "strong_content_modality_pair", variant: "typed" },
    }),
    createGoldenCase({
        caseId: "strong_content_voice_with_fillers",
        title: "Equivalent voice content with fillers",
        question: {
            category: "behavioral",
            questionText: "Tell me about a time you fixed a recurring inventory problem.",
            plannedPurpose: "Look for diagnosis, ownership, action, and measurable follow-through.",
        },
        answer: {
            mode: "voice",
            text: inventoryAnswer,
        },
        roleContext: inventoryRoleContext,
        voiceMarkers: {
            fillerWordCount: 6,
            longPauseCount: 1,
            wordsPerMinute: 132,
        },
        expectation: {
            allowedUsability: ["usable"],
            markerValues: {
                answeredQuestion: true,
                hasExample: true,
                hasPersonalAction: true,
                hasOutcomeOrTakeaway: true,
            },
            allowedInterventions: ["affirm_and_continue", "polish_then_continue"],
            primaryStrength: "present",
            deliveryNote: "present",
        },
        fairnessPair: { pairId: "strong_content_modality_pair", variant: "voice" },
    }),
    createGoldenCase({
        caseId: "confidently_wrong_database_indexing",
        title: "Confidently wrong technical answer",
        question: {
            category: "technical_role_specific",
            questionText: "What is a database index, and what tradeoff does it introduce?",
            plannedPurpose: "Look for a correct explanation, practical use, and tradeoff awareness.",
        },
        answer: {
            mode: "text",
            text: "A database index encrypts table data so searches are secure. It improves every database operation without adding storage or slowing down writes.",
        },
        roleContext: databaseRoleContext,
        technicalReference: {
            source: "curated",
            version: "database-index-basics-v1",
            expectedConcepts: [
                {
                    id: "index_lookup_structure",
                    description: "An index is a separate lookup structure that helps the database locate rows without scanning the whole table.",
                },
                {
                    id: "index_write_storage_tradeoff",
                    description: "Indexes use storage and can make inserts, updates, and deletes more expensive because the index must also be maintained.",
                },
            ],
            acceptableAlternatives: [
                "An index is comparable to a book index that points to data locations.",
            ],
            commonMisconceptions: [
                "An index encrypts table data.",
                "An index has no storage or write cost.",
            ],
        },
        expectation: {
            allowedUsability: ["usable"],
            markerValues: { answeredQuestion: true, hasDirectAnswer: true },
            technicalAccuracy: "contradicted",
            verificationRequired: true,
            criterionBands: {
                answer_focus: ["clear", "strong"],
                role_skill_signal: ["emerging"],
            },
            allowedInterventions: ["revise_answer", "build_missing_signal"],
        },
    }),
] as const;

function createGoldenCase(input: {
    caseId: string;
    title: string;
    question: {
        category: EvidenceFirstEvaluationCase["providerInput"]["question"]["category"];
        questionText: string;
        plannedPurpose: string;
    };
    answer: {
        mode: EvidenceFirstEvaluationCase["providerInput"]["answer"]["mode"];
        text: string;
    };
    roleContext: EvidenceFirstEvaluationCase["providerInput"]["roleContext"];
    expectation: CandidateEvaluatorGoldenExpectation;
    technicalReference?: NonNullable<EvidenceFirstEvaluationCase["providerInput"]["technicalReference"]>;
    voiceMarkers?: NonNullable<EvidenceFirstEvaluationCase["providerInput"]["voiceMarkers"]>;
    fairnessPair?: CandidateEvaluatorGoldenCase["fairnessPair"];
}): CandidateEvaluatorGoldenCase {
    return {
        caseId: input.caseId,
        title: input.title,
        evaluationCase: createEvidenceFirstEvaluationCase({
            answerAttemptId: `qa-golden:${input.caseId}:attempt-1`,
            question: {
                slotId: `qa-golden:${input.caseId}:slot-1`,
                questionIndex: 0,
                category: input.question.category,
                questionText: input.question.questionText,
                plannedPurpose: input.question.plannedPurpose,
            },
            answer: {
                mode: input.answer.mode,
                text: input.answer.text,
                submittedAt,
            },
            roleContext: input.roleContext,
            technicalReference: input.technicalReference,
            voiceMarkers: input.voiceMarkers,
        }),
        expectation: input.expectation,
        ...(input.fairnessPair ? { fairnessPair: input.fairnessPair } : {}),
    };
}
