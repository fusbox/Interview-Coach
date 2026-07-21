import {
    createEvidenceFirstEvaluationCase,
    type CriterionAppraisal,
    type EvidenceFirstEvaluationCase,
    type EvidenceExtractionOutput,
    type FeedbackCompositionOutput,
    type UniversalCriterionId,
} from "./evidence-first-evaluator-contract";

export const CANDIDATE_EVALUATOR_GOLDEN_SUITE_VERSION = "candidate_evaluator_golden_v2" as const;

type ObservableMarker = keyof EvidenceExtractionOutput["observableMarkers"];
type CategorySignalStatus = EvidenceExtractionOutput["categorySignals"][number]["status"];
type SensitiveContentFlag = EvidenceExtractionOutput["sensitiveContentFlags"][number];
type AnswerUsability = EvidenceExtractionOutput["answerUsability"]["status"];
type TechnicalAccuracy = EvidenceExtractionOutput["technicalAccuracy"]["status"];
type Intervention = FeedbackCompositionOutput["feedbackPlan"]["intervention"];
type CriterionBand = NonNullable<CriterionAppraisal["band"]>;

export type CandidateEvaluatorCriterionExpectation = {
    allowedApplicability: readonly CriterionAppraisal["applicability"][];
    allowedBands?: readonly CriterionBand[];
};

export type CandidateEvaluatorGoldenExpectation = {
    allowedUsability: readonly AnswerUsability[];
    markerValues?: Partial<Record<ObservableMarker, boolean>>;
    categorySignalStatuses?: Readonly<Record<string, readonly CategorySignalStatus[]>>;
    requiredSensitiveFlags?: readonly SensitiveContentFlag[];
    technicalAccuracy?: TechnicalAccuracy;
    verificationRequired?: boolean;
    allowedInterventions?: readonly Intervention[];
    allowedPatternGapIds?: readonly string[];
    criterionAppraisals: Record<UniversalCriterionId, CandidateEvaluatorCriterionExpectation>;
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

const emerging = observed("emerging");
const clearOrStrong = observed("clear", "strong");
const insufficient = applicability("insufficient_data");
const notElicited = applicability("not_elicited");

function observed(...allowedBands: CriterionBand[]): CandidateEvaluatorCriterionExpectation {
    return { allowedApplicability: ["observed"], allowedBands };
}

function applicability(
    ...allowedApplicability: CriterionAppraisal["applicability"][]
): CandidateEvaluatorCriterionExpectation {
    return { allowedApplicability };
}

function criteria(input: Record<UniversalCriterionId, CandidateEvaluatorCriterionExpectation>) {
    return input;
}

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
            criterionAppraisals: criteria({
                answer_focus: emerging,
                organization: emerging,
                evidence_specificity: emerging,
                role_skill_signal: emerging,
                impact_judgment_takeaway: emerging,
            }),
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
            criterionAppraisals: criteria({
                answer_focus: { allowedApplicability: ["observed", "insufficient_data"], allowedBands: ["emerging"] },
                organization: insufficient,
                evidence_specificity: insufficient,
                role_skill_signal: insufficient,
                impact_judgment_takeaway: insufficient,
            }),
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
            criterionAppraisals: criteria({
                answer_focus: insufficient,
                organization: insufficient,
                evidence_specificity: insufficient,
                role_skill_signal: insufficient,
                impact_judgment_takeaway: insufficient,
            }),
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
            criterionAppraisals: criteria({
                answer_focus: clearOrStrong,
                organization: clearOrStrong,
                evidence_specificity: clearOrStrong,
                role_skill_signal: clearOrStrong,
                impact_judgment_takeaway: clearOrStrong,
            }),
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
            criterionAppraisals: criteria({
                answer_focus: clearOrStrong,
                organization: clearOrStrong,
                evidence_specificity: clearOrStrong,
                role_skill_signal: clearOrStrong,
                impact_judgment_takeaway: clearOrStrong,
            }),
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
            criterionAppraisals: criteria({
                answer_focus: clearOrStrong,
                organization: clearOrStrong,
                evidence_specificity: clearOrStrong,
                role_skill_signal: clearOrStrong,
                impact_judgment_takeaway: clearOrStrong,
            }),
            allowedInterventions: ["affirm_and_continue", "polish_then_continue"],
            primaryStrength: "present",
            deliveryNote: "present",
        },
        fairnessPair: { pairId: "strong_content_modality_pair", variant: "voice" },
    }),
    createGoldenCase({
        caseId: "brief_screening_logistics_answer",
        title: "Brief but sufficient screening logistics answer",
        question: {
            category: "screening",
            questionText: "When could you start this warehouse associate role?",
            plannedPurpose: "Confirm practical start-date readiness without requiring a story.",
        },
        answer: {
            mode: "text",
            text: "I can start two weeks after an offer.",
        },
        roleContext: warehouseRoleContext,
        expectation: {
            allowedUsability: ["usable"],
            markerValues: {
                answeredQuestion: true,
                isVeryShort: true,
            },
            categorySignalStatuses: {
                has_logistics_clarity: ["observed"],
            },
            criterionAppraisals: criteria({
                answer_focus: clearOrStrong,
                organization: clearOrStrong,
                evidence_specificity: notElicited,
                role_skill_signal: notElicited,
                impact_judgment_takeaway: clearOrStrong,
            }),
            allowedInterventions: ["affirm_and_continue", "polish_then_continue"],
            allowedPatternGapIds: ["reinforce_effective_pattern"],
        },
    }),
    createGoldenCase({
        caseId: "behavioral_team_result_without_personal_action",
        title: "Team result without personal action",
        question: {
            category: "behavioral",
            questionText: "Tell me about a time you helped resolve a customer problem.",
            plannedPurpose: "Look for the candidate's own contribution and the result.",
        },
        answer: {
            mode: "text",
            text: "We worked together to fix the issue and the customer was happy.",
        },
        roleContext: customerServiceRoleContext,
        expectation: {
            allowedUsability: ["thin", "usable"],
            markerValues: {
                answeredQuestion: true,
                hasPersonalAction: false,
                hasOutcomeOrTakeaway: true,
            },
            categorySignalStatuses: {
                has_personal_action: ["not_observed"],
                has_result: ["observed"],
            },
            criterionAppraisals: criteria({
                answer_focus: observed("emerging", "clear", "strong"),
                organization: observed("emerging", "clear"),
                evidence_specificity: observed("emerging", "clear"),
                role_skill_signal: emerging,
                impact_judgment_takeaway: observed("emerging", "clear"),
            }),
            allowedInterventions: ["revise_answer", "build_missing_signal", "polish_then_continue"],
            allowedPatternGapIds: ["missing_personal_action"],
        },
    }),
    createGoldenCase({
        caseId: "scenario_solution_without_problem_framing",
        title: "Scenario answer jumps to a solution",
        question: {
            category: "case_scenario",
            questionText: "A project is behind schedule. What would you do?",
            plannedPurpose: "Look for problem framing, priorities, tradeoffs, and a practical next step.",
        },
        answer: {
            mode: "text",
            text: "I would ask the team to move faster and work overtime.",
        },
        roleContext: entryLevelRoleContext,
        expectation: {
            allowedUsability: ["thin", "usable"],
            markerValues: {
                answeredQuestion: true,
            },
            categorySignalStatuses: {
                has_problem_framing: ["not_observed"],
                has_recommendation: ["observed"],
            },
            criterionAppraisals: criteria({
                answer_focus: observed("emerging", "clear", "strong"),
                organization: observed("emerging", "clear"),
                evidence_specificity: observed("emerging", "clear"),
                role_skill_signal: emerging,
                impact_judgment_takeaway: observed("emerging", "clear"),
            }),
            allowedInterventions: ["revise_answer", "build_missing_signal", "polish_then_continue"],
            allowedPatternGapIds: ["missing_problem_framing"],
        },
    }),
    createGoldenCase({
        caseId: "generic_culture_fit_answer",
        title: "Generic culture and fit answer",
        question: {
            category: "culture_fit",
            questionText: "What kind of team environment helps you do your best work?",
            plannedPurpose: "Look for grounded work-style preferences, self-awareness, and role connection.",
        },
        answer: {
            mode: "text",
            text: "I like positive teams where everyone communicates and supports each other.",
        },
        roleContext: customerServiceRoleContext,
        expectation: {
            allowedUsability: ["usable"],
            markerValues: {
                answeredQuestion: true,
                hasDirectAnswer: true,
                hasExample: false,
            },
            categorySignalStatuses: {
                has_motivation: ["observed"],
                has_specific_example: ["not_observed"],
                has_role_connection: ["not_observed"],
            },
            criterionAppraisals: criteria({
                answer_focus: observed("strong"),
                organization: observed("emerging", "clear"),
                evidence_specificity: observed("emerging", "clear"),
                role_skill_signal: emerging,
                impact_judgment_takeaway: observed("emerging", "clear"),
            }),
            allowedInterventions: ["revise_answer", "build_missing_signal", "polish_then_continue"],
            allowedPatternGapIds: ["generic_motivation"],
        },
    }),
    createGoldenCase({
        caseId: "strong_content_non_native_grammar",
        title: "Strong content with non-native grammar",
        question: {
            category: "behavioral",
            questionText: "Tell me about a time you handled an urgent delivery problem.",
            plannedPurpose: "Look for prioritization, personal action, communication, and a result.",
        },
        answer: {
            mode: "text",
            text: "At my last warehouse, delivery came late and we have many boxes. I make list by priority, ask one coworker help urgent orders, and tell supervisor what may be late. We finish urgent orders same day, and next morning I update checklist so team can do faster next time.",
        },
        roleContext: warehouseRoleContext,
        expectation: {
            allowedUsability: ["usable"],
            markerValues: {
                answeredQuestion: true,
                hasExample: true,
                hasPersonalAction: true,
                hasOutcomeOrTakeaway: true,
            },
            categorySignalStatuses: {
                has_context: ["observed"],
                has_personal_action: ["observed"],
                has_result: ["observed"],
            },
            criterionAppraisals: criteria({
                answer_focus: clearOrStrong,
                organization: clearOrStrong,
                evidence_specificity: clearOrStrong,
                role_skill_signal: clearOrStrong,
                impact_judgment_takeaway: clearOrStrong,
            }),
            allowedInterventions: ["affirm_and_continue", "polish_then_continue"],
            primaryStrength: "present",
            deliveryNote: "absent",
        },
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
            criterionAppraisals: criteria({
                answer_focus: clearOrStrong,
                organization: observed("emerging", "clear"),
                evidence_specificity: emerging,
                role_skill_signal: emerging,
                impact_judgment_takeaway: emerging,
            }),
            allowedInterventions: ["revise_answer", "build_missing_signal"],
            allowedPatternGapIds: ["technical_accuracy_contradicted"],
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
