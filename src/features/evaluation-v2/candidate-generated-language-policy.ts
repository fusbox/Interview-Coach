export type ProhibitedCandidateJudgment = {
    ruleId: string;
    fieldIndex: number;
};

export type UngroundedTechnicalCoachingClaim = {
    ruleId: "technical_correctness_implied" | "exact_technical_fact_requested";
    fieldIndex: number;
};

const prohibitedJudgmentPatterns: Array<{ ruleId: string; pattern: RegExp }> = [
    {
        ruleId: "coach_assigned_score",
        pattern: /\b(?:you|your (?:answer|response|performance)|this (?:answer|response))\s+(?:(?:have\s+|has\s+|had\s+|would\s+)?(?:score|scored|scores)\b|(?:have\s+|has\s+|had\s+|would\s+)?(?:earned|received|got|gets|deserves|merits|earn|receive|get)\s+(?:(?:a|the)\s+)?(?:\d{1,3}\s*%?\s+)?score\b)/i,
    },
    {
        ruleId: "coach_assigned_grade",
        pattern: /\b(?:you|your (?:answer|response|performance)|this (?:answer|response))\s+(?:(?:was\s+|is\s+|would\s+be\s+)?graded\b|(?:have\s+|has\s+|had\s+|would\s+)?(?:earned|received|got|gets|deserves|merits|earn|receive|get)\s+(?:(?:a|an)\s+)?(?:(?:high|low|good|bad|passing|failing|[a-f][+-]?)\s+)?grade\b)/i,
    },
    {
        ruleId: "coach_assigned_rank",
        pattern: /\b(?:you|your (?:answer|response|performance)|this (?:answer|response))\s+(?:(?:have\s+|has\s+|had\s+|would\s+)?(?:rank|ranked|ranks)\b|(?:have\s+|has\s+|had\s+|would\s+)?(?:earned|received|got|gets|earn|receive|get)\s+(?:(?:a|the)\s+)?(?:rank|ranking|percentile)\b)/i,
    },
    {
        ruleId: "coach_assigned_pass_fail",
        pattern: /\b(?:you|your (?:answer|response|performance)|this (?:answer|response))\s+(?:would\s+|has\s+|have\s+|had\s+)?(?:pass|passed|passes|passing|fail|failed|fails|failing)\b/i,
    },
    {
        ruleId: "coach_assigned_numeric_result",
        pattern: /\b(?:your|this|the)\s+(?:answer|response|performance)\b.{0,24}\b(?:score|grade|rank|percentile|correctness)\b.{0,12}\b\d{1,3}\s*%|\b(?:your|this|the)\s+(?:answer|response|performance)\b.{0,24}\b\d{1,3}\s*%\b.{0,12}\b(?:score|grade|rank|percentile|correctness)\b/i,
    },
    {
        ruleId: "coach_recommends_judgment_improvement",
        pattern: /\b(?:raise|improve|increase|boost|lower)\s+(?:your|the)\s+(?:score|grade|rank|ranking|percentile)\b/i,
    },
    {
        ruleId: "coach_claims_perfect_answer",
        pattern: /\b(?:this|your|the)\s+(?:answer|response)\s+(?:is|was|looks|seems)\s+(?:like\s+)?(?:a\s+)?perfect\b/i,
    },
    {
        ruleId: "coach_claims_no_weaknesses",
        pattern: /\b(?:you|your (?:answer|response))\b.{0,32}\bno weaknesses\b/i,
    },
];

const sourceVocabularyByRuleId: Record<string, RegExp> = {
    coach_assigned_score: /\b(?:score|scored|scores|scoring)\b/i,
    coach_assigned_grade: /\b(?:grade|graded|grades|grading)\b/i,
    coach_assigned_rank: /\b(?:rank|ranked|ranks|ranking|percentile)\b/i,
    coach_assigned_pass_fail: /\b(?:pass|passed|passes|passing|fail|failed|fails|failing)\b/i,
    coach_assigned_numeric_result: /\b(?:score|grade|rank|percentile|correctness|performance)\b|\b\d{1,3}\s*%\b/i,
    coach_claims_perfect_answer: /\bperfect\b/i,
    coach_claims_no_weaknesses: /\bno weaknesses\b/i,
};

export function findProhibitedCandidateJudgments(
    values: readonly string[],
    options?: { sourceTexts?: readonly string[] },
) {
    const findings: ProhibitedCandidateJudgment[] = [];
    const sourceText = options?.sourceTexts?.join("\n") ?? "";
    values.forEach((value, fieldIndex) => {
        for (const { ruleId, pattern } of prohibitedJudgmentPatterns) {
            if (
                pattern.test(value)
                && !(sourceText && sourceVocabularyByRuleId[ruleId]?.test(sourceText))
            ) {
                findings.push({ ruleId, fieldIndex });
            }
        }
    });
    return findings;
}

export function findUngroundedTechnicalCoachingClaims(values: readonly string[]) {
    const findings: UngroundedTechnicalCoachingClaim[] = [];
    values.forEach((value, fieldIndex) => {
        if (containsUngroundedTechnicalCorrectnessClaim(value)) {
            findings.push({ ruleId: "technical_correctness_implied", fieldIndex });
        }
        if (containsUngroundedExactTechnicalFactRequest(value)) {
            findings.push({ ruleId: "exact_technical_fact_requested", fieldIndex });
        }
    });
    return findings;
}

function containsUngroundedTechnicalCorrectnessClaim(value: string) {
    return [
        /\b(?:demonstrat(?:e|es|ed|ing)|show(?:s|ed|ing)?)\b.{0,48}\b(?:good|strong|clear|solid|sound|correct|accurate)\b.{0,24}\b(?:technical\s+)?(?:understanding|knowledge|grasp|reasoning)\b/i,
        /\b(?:good|strong|clear|solid|sound|correct|accurate)\b.{0,16}\b(?:technical\s+)?(?:understanding|knowledge|grasp|reasoning)\b/i,
        /\b(?:your|the)\b.{0,24}\b(?:technical\s+)?(?:reasoning|approach|method|process)\b.{0,16}\b(?:is|was|seems|looks)\b.{0,12}\b(?:correct|accurate|sound|right)\b/i,
        /\b(?:your|the)\b.{0,32}\b(?:reasoning|choice|technical\s+(?:answer|approach))\b.{0,20}\b(?:is|was|seems|looks)?\s*(?:good|strong|solid|sound|correct|accurate|right)\b.{0,64}\b(?:demonstrat(?:e|es|ed|ing)|show(?:s|ed|ing)?)\b.{0,24}\b(?:an?\s+)?(?:understanding|knowledge|grasp)\b/i,
    ].some((pattern) => pattern.test(value));
}

function containsUngroundedExactTechnicalFactRequest(value: string) {
    return [
        /\b(?:add|include|state|give|name|provide|clarify|identify|specify|explain|say|what)\b.{0,56}\b(?:exact|specific)\b.{0,32}\b(?:number|count|value|limit|requirement|specification|standard|capacity|size|measurement)\b/i,
        /\bexactly how many\b/i,
        /\bexact (?:host |address |port |version |code |error )?count\b/i,
    ].some((pattern) => pattern.test(value));
}
