import { candidateSetupStageOptions, type CandidateSetupStageId } from "./candidate-setup-contract";
import {
    createCandidateQuestionPlan,
    createCandidateQuestionPlanFromSlots,
    type CandidateQuestionPlan,
} from "@/features/candidate-session-v2/candidate-question-plan";
import {
    parseCandidateQuestionWordingResult,
    type CandidateQuestionWordingResult,
} from "@/features/candidate-session-v2/candidate-question-wording";

export type CandidatePracticePlanBaselineV1Snapshot = CandidateQuestionPlan & {
    status: "candidate_practice_plan_baseline_v1";
};

export type CandidatePracticePlanBaselineV2Snapshot = CandidateQuestionPlan & {
    status: "candidate_practice_plan_baseline_v2";
    stageRecommendedQuestionCount: number;
    paceSize: number;
};

export type CandidatePracticePlanBaselineSnapshot =
    | CandidatePracticePlanBaselineV1Snapshot
    | CandidatePracticePlanBaselineV2Snapshot;

const stageBaselineQuestionCounts: Record<CandidateSetupStageId, number> = {
    practice_only: 5,
    screening: 5,
    first_interview: 7,
    follow_up: 10,
    final_interview: 10,
};

export function getCandidateStageBaselineQuestionCount(interviewStage: CandidateSetupStageId) {
    return stageBaselineQuestionCounts[interviewStage];
}

export function createCandidatePracticePlanBaseline(
    interviewStage: CandidateSetupStageId,
    selectedQuestionCount = getCandidateStageBaselineQuestionCount(interviewStage),
): CandidatePracticePlanBaselineV2Snapshot {
    const stageRecommendedQuestionCount = getCandidateStageBaselineQuestionCount(interviewStage);
    return {
        status: "candidate_practice_plan_baseline_v2",
        stageRecommendedQuestionCount,
        paceSize: selectedQuestionCount,
        ...createCandidateQuestionPlan({
            interviewStage,
            questionCount: Math.max(stageRecommendedQuestionCount, selectedQuestionCount),
        }),
    };
}

export function createCandidateQuestionGenerationPlan({
    baseline,
    selectedQuestionCount,
}: {
    baseline: CandidatePracticePlanBaselineSnapshot;
    selectedQuestionCount: number;
}) {
    return createCandidateQuestionPlan({
        interviewStage: baseline.interviewStage,
        questionCount: Math.max(baseline.questionCount, selectedQuestionCount),
    });
}

export function deriveCandidateInitialRoundPlan({
    baseline,
    generationPlan,
}: {
    baseline: CandidatePracticePlanBaselineSnapshot;
    generationPlan: CandidateQuestionPlan;
}) {
    return createCandidateQuestionPlanFromSlots({
        interviewStage: baseline.interviewStage,
        slots: generationPlan.slots.slice(0, baseline.questionCount).map((slot, index) => {
            const baselineSlot = baseline.slots[index];
            if (!baselineSlot) {
                throw new Error("Canonical initial-session plan must match the persisted baseline.");
            }
            return {
                ...slot,
                planQuestionId: baselineSlot.id,
                coverageKind: "baseline" as const,
            };
        }),
    });
}

export function deriveCandidateBaselineWording({
    baseline,
    generatedWording,
}: {
    baseline: CandidatePracticePlanBaselineSnapshot;
    generatedWording: CandidateQuestionWordingResult;
}) {
    return parseCandidateQuestionWordingResult({
        ...generatedWording,
        questions: generatedWording.questions.slice(0, baseline.questionCount),
    }, baseline);
}

export function deriveCandidateInitialRoundWording({
    roundPlan,
    generatedWording,
}: {
    roundPlan: CandidateQuestionPlan;
    generatedWording: CandidateQuestionWordingResult;
}) {
    return parseCandidateQuestionWordingResult({
        ...generatedWording,
        questions: generatedWording.questions.slice(0, roundPlan.questionCount),
    }, roundPlan);
}

export function parseCandidatePracticePlanBaselineSnapshot(
    value: unknown,
): CandidatePracticePlanBaselineSnapshot | null {
    if (
        !isObject(value)
        || (
            value.status !== "candidate_practice_plan_baseline_v1"
            && value.status !== "candidate_practice_plan_baseline_v2"
        )
    ) {
        return null;
    }
    const interviewStage = candidateSetupStageOptions.find((stage) => stage.id === value.interviewStage)?.id;
    if (!interviewStage) {
        return null;
    }
    const stageRecommendedQuestionCount = getCandidateStageBaselineQuestionCount(interviewStage);
    const questionCount = readBoundedQuestionCount(value.questionCount);
    if (!questionCount) {
        return null;
    }
    if (value.status === "candidate_practice_plan_baseline_v1" && questionCount !== stageRecommendedQuestionCount) {
        return null;
    }
    if (value.status === "candidate_practice_plan_baseline_v2") {
        const persistedStageRecommendedQuestionCount = readBoundedQuestionCount(
            value.stageRecommendedQuestionCount,
        );
        const paceSize = readBoundedQuestionCount(value.paceSize);
        if (
            !persistedStageRecommendedQuestionCount
            || !paceSize
            || questionCount < persistedStageRecommendedQuestionCount
            || paceSize > questionCount
        ) {
            return null;
        }
    }
    const expected = createCandidateQuestionPlan({ interviewStage, questionCount });
    if (
        questionCount !== expected.questionCount
        || !Array.isArray(value.slots)
        || value.slots.length !== expected.slots.length
    ) {
        return null;
    }
    const slotsMatch = value.slots.every((slot, index) => {
        if (!isObject(slot)) {
            return false;
        }
        const expectedSlot = expected.slots[index];
        return slot.id === expectedSlot.id
            && slot.index === expectedSlot.index
            && slot.category === expectedSlot.category;
    });
    return slotsMatch ? value as CandidatePracticePlanBaselineSnapshot : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readBoundedQuestionCount(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value >= 3 && value <= 10
        ? value
        : null;
}
