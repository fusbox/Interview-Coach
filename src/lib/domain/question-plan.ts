import { normalizeInterviewStage, type InterviewStage } from "@/lib/domain/interview-stage";

export const QUESTION_PLAN_CATEGORY_ORDER = [
    "screening",
    "behavioral",
    "culture_fit",
    "case_scenario",
    "technical_role_specific",
] as const;

export type QuestionPlanCategory = typeof QUESTION_PLAN_CATEGORY_ORDER[number];

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

export type PracticeCoverageBaseline = {
    interviewStage: InterviewStage;
    minimumQuestionCount: number;
    categoryMinimums: Record<QuestionPlanCategory, number>;
};

const QUESTION_COUNT_MIN = 1;
const QUESTION_COUNT_MAX = 20;

const RIGOR_BASELINE_QUESTION_COUNTS: Record<InterviewStage, number> = {
    not_sure: 5,
    initial_screening: 5,
    initial_interview: 7,
    follow_up_final: 10,
    practice_only: 5,
};

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

export function buildPracticeCoverageBaseline(input: QuestionPlanInput = {}): PracticeCoverageBaseline {
    const plan = buildRigorBaselineQuestionPlan(input);
    return buildPracticeCoverageBaselineFromQuestionPlan(plan);
}

export function buildRigorBaselineQuestionPlan(input: Pick<QuestionPlanInput, "interviewStage"> = {}): QuestionPlan {
    const interviewStage = normalizeInterviewStage(input.interviewStage);
    return buildQuestionPlan({
        interviewStage,
        questionCount: getRigorBaselineQuestionCount(interviewStage),
    });
}

export function getRigorBaselineQuestionCount(value: InterviewStage | null | undefined): number {
    return RIGOR_BASELINE_QUESTION_COUNTS[normalizeInterviewStage(value)];
}

export function buildPracticeCoverageBaselineFromQuestionPlan(plan: QuestionPlan): PracticeCoverageBaseline {
    return {
        interviewStage: plan.interviewStage,
        minimumQuestionCount: plan.questionCount,
        categoryMinimums: plan.categoryCounts,
    };
}

export function parseQuestionPlanSnapshot(value: unknown): QuestionPlan | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const candidate = value as Record<string, unknown>;
    const interviewStage = normalizeInterviewStage(candidate.interviewStage);
    const questionCount = normalizeQuestionPlanCount(asFiniteNumber(candidate.questionCount));
    const rawCategoryCounts = candidate.categoryCounts && typeof candidate.categoryCounts === "object"
        ? candidate.categoryCounts as Record<string, unknown>
        : {};
    const categoryCounts = QUESTION_PLAN_CATEGORY_ORDER.reduce((counts, category) => {
        counts[category] = Math.max(0, Math.trunc(asFiniteNumber(rawCategoryCounts[category]) ?? 0));
        return counts;
    }, { ...EMPTY_CATEGORY_COUNTS });
    const slots = Array.isArray(candidate.slots)
        ? candidate.slots
            .map((slot, fallbackIndex): QuestionPlanSlot | null => {
                if (!slot || typeof slot !== "object") {
                    return null;
                }
                const source = slot as Record<string, unknown>;
                const category = typeof source.category === "string" && QUESTION_PLAN_CATEGORY_ORDER.includes(source.category as QuestionPlanCategory)
                    ? source.category as QuestionPlanCategory
                    : null;
                if (!category) {
                    return null;
                }
                const index = asFiniteNumber(source.index) ?? fallbackIndex;
                return {
                    id: typeof source.id === "string" && source.id.trim() ? source.id : `${category}-${fallbackIndex + 1}`,
                    index: Math.max(0, Math.trunc(index)),
                    category,
                };
            })
            .filter((slot): slot is QuestionPlanSlot => Boolean(slot))
            .sort((a, b) => a.index - b.index)
        : [];

    if (Object.values(categoryCounts).reduce((sum, count) => sum + count, 0) !== questionCount || slots.length !== questionCount) {
        return buildQuestionPlan({ interviewStage, questionCount });
    }

    return {
        interviewStage,
        questionCount,
        categoryCounts,
        slots,
    };
}

function asFiniteNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
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
