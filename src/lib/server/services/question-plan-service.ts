import {
    getInterviewStageLabel,
    INTERVIEW_STAGE_OPTIONS,
    normalizeInterviewStage,
    type InterviewStage,
} from "@/lib/domain/interview-stage";

export const QUESTION_PLAN_CATEGORY_ORDER = [
    "screening",
    "behavioral",
    "culture_fit",
    "case_scenario",
    "technical_role_specific",
] as const;

export type QuestionPlanCategory = typeof QUESTION_PLAN_CATEGORY_ORDER[number];

export { getInterviewStageLabel, INTERVIEW_STAGE_OPTIONS, normalizeInterviewStage, type InterviewStage };


export type QuestionPlanSlot = {
    id: string;
    index: number;
    category: QuestionPlanCategory;
};

export type QuestionPlan = {
    interviewStage: InterviewStage;
    questionCount: number;
    categoryCounts: Record<QuestionPlanCategory, number>;
    slots: QuestionPlanSlot[];
};

type QuestionPlanInput = {
    interviewStage?: InterviewStage | null;
    questionCount?: number | null;
};

const QUESTION_COUNT_MIN = 1;
const QUESTION_COUNT_MAX = 20;

const STAGE_WEIGHTS: Record<InterviewStage, Record<QuestionPlanCategory, number>> = {
    not_sure: {
        screening: 1,
        behavioral: 2,
        culture_fit: 1,
        case_scenario: 1,
        technical_role_specific: 1,
    },
    initial_screening: {
        screening: 3,
        behavioral: 1,
        culture_fit: 2,
        case_scenario: 0,
        technical_role_specific: 1,
    },
    initial_interview: {
        screening: 1,
        behavioral: 3,
        culture_fit: 2,
        case_scenario: 1,
        technical_role_specific: 2,
    },
    follow_up_final: {
        screening: 0,
        behavioral: 2,
        culture_fit: 1,
        case_scenario: 2,
        technical_role_specific: 2,
    },
    practice_only: {
        screening: 1,
        behavioral: 2,
        culture_fit: 1,
        case_scenario: 1,
        technical_role_specific: 1,
    },
};

const EMPTY_CATEGORY_COUNTS = QUESTION_PLAN_CATEGORY_ORDER.reduce(
    (counts, category) => ({ ...counts, [category]: 0 }),
    {} as Record<QuestionPlanCategory, number>,
);

export function buildQuestionPlan(input: QuestionPlanInput = {}): QuestionPlan {
    const interviewStage = normalizeInterviewStage(input.interviewStage);
    const questionCount = normalizeQuestionPlanCount(input.questionCount);
    const categoryCounts = allocateCategoryCounts(interviewStage, questionCount);
    const slots = QUESTION_PLAN_CATEGORY_ORDER.flatMap((category) => (
        Array.from({ length: categoryCounts[category] }, (_, offset) => ({
            id: `${category}-${offset + 1}`,
            index: 0,
            category,
        }))
    )).map((slot, index) => ({ ...slot, index }));

    return {
        interviewStage,
        questionCount,
        categoryCounts,
        slots,
    };
}

export function normalizeQuestionPlanCount(questionCount: number | null | undefined): number {
    if (questionCount == null || !Number.isFinite(questionCount)) {
        return 5;
    }

    return Math.min(Math.max(Math.trunc(questionCount), QUESTION_COUNT_MIN), QUESTION_COUNT_MAX);
}

function allocateCategoryCounts(
    interviewStage: InterviewStage,
    questionCount: number,
): Record<QuestionPlanCategory, number> {
    const weights = STAGE_WEIGHTS[interviewStage];
    const counts = { ...EMPTY_CATEGORY_COUNTS };
    const weightedCategories = QUESTION_PLAN_CATEGORY_ORDER.filter((category) => weights[category] > 0);

    for (let index = 0; index < questionCount; index += 1) {
        const category = weightedCategories[index % weightedCategories.length] ?? "behavioral";
        counts[category] += 1;
    }

    return counts;
}
