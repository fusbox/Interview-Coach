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

export type CandidatePracticePlanBaselineSnapshot = CandidateQuestionPlan & {
    status: "candidate_practice_plan_baseline_v1";
};

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
): CandidatePracticePlanBaselineSnapshot {
    return {
        status: "candidate_practice_plan_baseline_v1",
        ...createCandidateQuestionPlan({
            interviewStage,
            questionCount: getCandidateStageBaselineQuestionCount(interviewStage),
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
    selectedQuestionCount,
}: {
    baseline: CandidatePracticePlanBaselineSnapshot;
    generationPlan: CandidateQuestionPlan;
    selectedQuestionCount: number;
}) {
    return createCandidateQuestionPlanFromSlots({
        interviewStage: baseline.interviewStage,
        slots: generationPlan.slots.slice(0, selectedQuestionCount).map((slot, index) => {
            const baselineSlot = baseline.slots[index];
            return baselineSlot
                ? {
                    ...slot,
                    planQuestionId: baselineSlot.id,
                    coverageKind: "baseline" as const,
                }
                : {
                    ...slot,
                    coverageKind: "supplemental" as const,
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
    if (!isObject(value) || value.status !== "candidate_practice_plan_baseline_v1") {
        return null;
    }
    const interviewStage = candidateSetupStageOptions.find((stage) => stage.id === value.interviewStage)?.id;
    if (!interviewStage) {
        return null;
    }
    const expected = createCandidatePracticePlanBaseline(interviewStage);
    if (
        value.questionCount !== expected.questionCount
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
