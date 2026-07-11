import { describe, expect, it } from "vitest";

import type { CandidateAnswerAnalysisProviderResult } from "./candidate-answer-analysis-adapter";
import { createCandidateAnswerCoachingFacts } from "./candidate-coaching-facts";

const analysisSnapshot: CandidateAnswerAnalysisProviderResult = {
    status: "answer_analysis_provider_result",
    provider: "candidate_v2_answer_evaluator",
    analyzedAt: "2026-07-10T21:00:00.000Z",
    answer: {
        slotId: "slot-1",
        questionIndex: 0,
    },
    coachFeedback: {
        acknowledgement: "You named a practical first step.",
        observation: "The answer would be stronger if you named the result.",
        nextPracticeFocus: "Add what changed after you made the decision.",
    },
    evidence: [
        {
            criterionId: "answer_specificity",
            applicability: "observed",
            score: 3.4,
        },
        {
            criterionId: "outcome_impact",
            applicability: "not_elicited",
        },
        {
            criterionId: "delivery_clarity",
            applicability: "unscoreable",
        },
    ],
};

describe("candidate answer coaching facts", () => {
    it("maps an accepted analysis snapshot into candidate-safe downstream facts", () => {
        expect(createCandidateAnswerCoachingFacts(analysisSnapshot)).toEqual({
            status: "candidate_answer_coaching_facts",
            provider: "candidate_v2_answer_evaluator",
            analyzedAt: "2026-07-10T21:00:00.000Z",
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
            },
            coachFeedback: {
                acknowledgement: "You named a practical first step.",
                observation: "The answer would be stronger if you named the result.",
                nextPracticeFocus: "Add what changed after you made the decision.",
            },
            overallRead: {
                band: "clear",
                headline: "Clear evidence",
                description: "The practiced answer gives the coach enough evidence to show a clear pattern.",
                observedCount: 1,
                excludedCount: 2,
            },
            criteriaFacts: [
                {
                    criterionId: "answer_specificity",
                    applicability: "observed",
                    band: "clear",
                    evidenceState: "observed",
                },
                {
                    criterionId: "outcome_impact",
                    applicability: "not_elicited",
                    band: "not_enough_evidence",
                    evidenceState: "not_elicited",
                },
                {
                    criterionId: "delivery_clarity",
                    applicability: "unscoreable",
                    band: "not_enough_evidence",
                    evidenceState: "unscoreable",
                },
            ],
            coverage: {
                observedCriteriaIds: ["answer_specificity"],
                notElicitedCriteriaIds: ["outcome_impact"],
                insufficientDataCriteriaIds: [],
                unscoreableCriteriaIds: ["delivery_clarity"],
            },
        });
    });

    it("does not expose raw scores or score averages in candidate-safe facts", () => {
        const facts = createCandidateAnswerCoachingFacts(analysisSnapshot);
        const serializedFacts = JSON.stringify(facts);

        expect(serializedFacts).not.toMatch(/"score"|"averageScore"|average/i);
        expect(serializedFacts).not.toContain("3.4");
    });

    it("treats non-observed evidence as coverage context rather than weak performance", () => {
        const facts = createCandidateAnswerCoachingFacts({
            ...analysisSnapshot,
            evidence: [
                {
                    criterionId: "outcome_impact",
                    applicability: "not_elicited",
                },
                {
                    criterionId: "delivery_clarity",
                    applicability: "insufficient_data",
                },
            ],
        });

        expect(facts.overallRead).toEqual({
            band: "not_enough_evidence",
            headline: "More practice needed",
            description: "The coach needs more answer evidence before showing a pattern.",
            observedCount: 0,
            excludedCount: 2,
        });
        expect(facts.criteriaFacts).toEqual([
            {
                criterionId: "outcome_impact",
                applicability: "not_elicited",
                band: "not_enough_evidence",
                evidenceState: "not_elicited",
            },
            {
                criterionId: "delivery_clarity",
                applicability: "insufficient_data",
                band: "not_enough_evidence",
                evidenceState: "insufficient_data",
            },
        ]);
    });
});
