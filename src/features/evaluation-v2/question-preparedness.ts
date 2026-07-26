import { z } from "zod";

import type {
    CriterionAppraisal,
    EvidenceExtractionOutput,
    ObservedBand,
} from "./evidence-first-evaluator-contract";
import { UNIVERSAL_CRITERION_IDS } from "./evidence-first-evaluator-contract";

export const QUESTION_PREPAREDNESS_POLICY_VERSION = "candidate_question_preparedness_v1" as const;

export const questionPreparednessResultSchema = z.discriminatedUnion("status", [
    z.object({
        status: z.literal("rated"),
        policyVersion: z.literal(QUESTION_PREPAREDNESS_POLICY_VERSION),
        band: z.enum(["emerging", "clear", "strong"]),
        ratedCriterionCount: z.number().int().min(1).max(5),
        notElicitedCriterionCount: z.number().int().min(0).max(5),
        unavailableCriterionCount: z.number().int().min(0).max(1),
        constraints: z.array(z.enum([
            "availability_cap",
            "technical_contradiction_cap",
        ])).max(2),
    }).strict(),
    z.object({
        status: z.literal("incomplete"),
        policyVersion: z.literal(QUESTION_PREPAREDNESS_POLICY_VERSION),
        reason: z.enum([
            "answer_not_usable",
            "criterion_set_incomplete",
            "multiple_unavailable_criteria",
            "no_rated_criteria",
        ]),
        ratedCriterionCount: z.number().int().min(0).max(5),
        notElicitedCriterionCount: z.number().int().min(0).max(5),
        unavailableCriterionCount: z.number().int().min(0).max(5),
    }).strict(),
]);

export type QuestionPreparednessBand = ObservedBand;
export type QuestionPreparednessResult = z.infer<typeof questionPreparednessResultSchema>;
type QuestionPreparednessCriterion = Pick<
    CriterionAppraisal,
    "criterionId" | "applicability" | "band"
>;

const bandValue: Record<QuestionPreparednessBand, number> = {
    emerging: 1,
    clear: 2,
    strong: 3,
};

export function deriveQuestionPreparedness(input: {
    answerUsability: EvidenceExtractionOutput["answerUsability"];
    technicalAccuracy: Pick<EvidenceExtractionOutput["technicalAccuracy"], "status">;
    criteria: QuestionPreparednessCriterion[];
}): QuestionPreparednessResult {
    const counts = countCriteria(input.criteria);
    if (!counts.hasCompleteCriterionSet) {
        return incomplete("criterion_set_incomplete", counts);
    }
    if (
        input.answerUsability.status === "non_answer"
        || input.answerUsability.status === "off_topic"
        || input.answerUsability.status === "transcription_unclear"
        || input.answerUsability.status === "sensitive_disclosure"
    ) {
        return incomplete("answer_not_usable", counts);
    }
    if (counts.unavailableCriterionCount >= 2) {
        return incomplete("multiple_unavailable_criteria", counts);
    }
    if (counts.ratedBands.length === 0) {
        return incomplete("no_rated_criteria", counts);
    }

    const sum = counts.ratedBands.reduce((total, band) => total + bandValue[band], 0);
    let band = resolveBandFromSum(sum, counts.ratedBands.length);
    const constraints: Array<"availability_cap" | "technical_contradiction_cap"> = [];

    if (counts.unavailableCriterionCount === 1 && band === "strong") {
        band = "clear";
        constraints.push("availability_cap");
    }
    if (input.technicalAccuracy.status === "contradicted" && band !== "emerging") {
        band = "emerging";
        constraints.push("technical_contradiction_cap");
    }

    return {
        status: "rated",
        policyVersion: QUESTION_PREPAREDNESS_POLICY_VERSION,
        band,
        ratedCriterionCount: counts.ratedBands.length,
        notElicitedCriterionCount: counts.notElicitedCriterionCount,
        unavailableCriterionCount: counts.unavailableCriterionCount,
        constraints,
    };
}

export function compareQuestionPreparednessBands(
    left: QuestionPreparednessBand,
    right: QuestionPreparednessBand,
) {
    return bandValue[left] - bandValue[right];
}

function resolveBandFromSum(sum: number, count: number): QuestionPreparednessBand {
    if (sum * 2 >= count * 5) return "strong";
    if (sum * 2 >= count * 3) return "clear";
    return "emerging";
}

function countCriteria(criteria: QuestionPreparednessCriterion[]) {
    const ratedBands: QuestionPreparednessBand[] = [];
    let notElicitedCriterionCount = 0;
    let unavailableCriterionCount = 0;
    const seenCriterionIds = new Set<string>();

    for (const criterion of criteria) {
        if (seenCriterionIds.has(criterion.criterionId)) {
            continue;
        }
        seenCriterionIds.add(criterion.criterionId);
        if (criterion.applicability === "observed" && criterion.band) {
            ratedBands.push(criterion.band);
        } else if (criterion.applicability === "not_elicited") {
            notElicitedCriterionCount += 1;
        } else {
            unavailableCriterionCount += 1;
        }
    }
    const missingCriterionCount = UNIVERSAL_CRITERION_IDS.filter((
        criterionId,
    ) => !seenCriterionIds.has(criterionId)).length;
    unavailableCriterionCount += missingCriterionCount;

    return {
        ratedBands,
        notElicitedCriterionCount,
        unavailableCriterionCount,
        hasCompleteCriterionSet: criteria.length === UNIVERSAL_CRITERION_IDS.length
            && seenCriterionIds.size === UNIVERSAL_CRITERION_IDS.length
            && missingCriterionCount === 0,
    };
}

function incomplete(
    reason: Extract<QuestionPreparednessResult, { status: "incomplete" }>["reason"],
    counts: ReturnType<typeof countCriteria>,
): QuestionPreparednessResult {
    return {
        status: "incomplete",
        policyVersion: QUESTION_PREPAREDNESS_POLICY_VERSION,
        reason,
        ratedCriterionCount: counts.ratedBands.length,
        notElicitedCriterionCount: counts.notElicitedCriterionCount,
        unavailableCriterionCount: counts.unavailableCriterionCount,
    };
}
