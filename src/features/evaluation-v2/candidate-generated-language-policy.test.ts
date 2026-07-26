import { describe, expect, it } from "vitest";

import {
    findProhibitedCandidateJudgments,
    findUngroundedTechnicalCoachingClaims,
} from "./candidate-generated-language-policy";

describe("candidate generated-language policy", () => {
    it("allows faithful recapitulation of candidate-provided score-like words", () => {
        expect(findProhibitedCandidateJudgments([
            "You described earning one of the highest grades in the class.",
            "You stayed until the system passed a full cycle.",
            "You explained why the earlier repair failed.",
            "Your example reduced processing time by 20%.",
        ])).toEqual([]);
        expect(findProhibitedCandidateJudgments(
            ["You scored 100% on the required safety assessment."],
            { sourceTexts: ["I scored 100% on the required safety assessment."] },
        )).toEqual([]);
    });

    it("rejects coach-assigned score, grade, rank, pass-fail, and absolute-quality claims", () => {
        const findings = findProhibitedCandidateJudgments([
            "You scored 100% on this practice.",
            "Your answer received a high grade.",
            "Your response ranks above other candidates.",
            "You passed this practice.",
            "This answer is perfect.",
            "Your answer has no weaknesses.",
        ]);

        expect(findings.map((finding) => finding.ruleId)).toEqual([
            "coach_assigned_score",
            "coach_assigned_grade",
            "coach_assigned_rank",
            "coach_assigned_pass_fail",
            "coach_claims_perfect_answer",
            "coach_claims_no_weaknesses",
        ]);
    });

    it("rejects technical correctness praise when no trusted reference was available", () => {
        expect(findUngroundedTechnicalCoachingClaims([
            "Your answer demonstrates a strong understanding of subnetting.",
            "The technical approach you described is correct.",
            "You showed sound technical reasoning.",
            "Your reasoning for the /26 choice was strong, demonstrating an understanding of address needs.",
        ])).toEqual([
            { ruleId: "technical_correctness_implied", fieldIndex: 0 },
            { ruleId: "technical_correctness_implied", fieldIndex: 1 },
            { ruleId: "technical_correctness_implied", fieldIndex: 2 },
            { ruleId: "technical_correctness_implied", fieldIndex: 3 },
        ]);
    });

    it("rejects requests for exact technical facts while allowing grounded process coaching", () => {
        expect(findUngroundedTechnicalCoachingClaims([
            "State the exact host count before finalizing your answer.",
            "Explain exactly how many addresses the subnet supports.",
            "Make your assumptions explicit and explain how you would verify the required capacity.",
            "You explained the steps you would take and named what you would verify.",
        ])).toEqual([
            { ruleId: "exact_technical_fact_requested", fieldIndex: 0 },
            { ruleId: "exact_technical_fact_requested", fieldIndex: 1 },
        ]);
    });
});
