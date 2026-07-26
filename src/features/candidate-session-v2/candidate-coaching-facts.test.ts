import { describe, expect, it } from "vitest";

import { createCandidateAnswerAnalysisProviderResultFixture } from "./candidate-answer-analysis-test-fixture";
import { createCandidateAnswerCoachingFacts } from "./candidate-coaching-facts";

const analysisSnapshot = createCandidateAnswerAnalysisProviderResultFixture({
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
    evidenceFirst: {
        technicalAccuracyStatus: "supported",
        criteria: [
            {
                criterionId: "answer_focus",
                applicability: "observed",
                band: "clear",
                evidenceSpanIds: [],
                reasonCode: "direct_answer",
            },
            {
                criterionId: "impact_judgment_takeaway",
                applicability: "not_elicited",
                evidenceSpanIds: [],
                reasonCode: "question_did_not_elicit_impact",
            },
            {
                criterionId: "organization",
                applicability: "unscoreable",
                evidenceSpanIds: [],
                reasonCode: "transcription_unclear",
            },
            {
                criterionId: "evidence_specificity",
                applicability: "observed",
                band: "clear",
                evidenceSpanIds: [],
                reasonCode: "specificity_clear",
            },
            {
                criterionId: "role_skill_signal",
                applicability: "observed",
                band: "strong",
                evidenceSpanIds: [],
                reasonCode: "role_skill_strong",
            },
        ],
    },
});

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
            supportedStrength: "You kept the answer connected to the question.",
            interaction: {
                intervention: "revise_answer",
                posture: "remediate",
            },
            appraisal: {
                answerUsability: {
                    status: "usable",
                    reasonCode: "fixture_usable_answer",
                },
                technicalAccuracy: {
                    status: "supported",
                },
                questionPreparedness: {
                    status: "rated",
                    policyVersion: "candidate_question_preparedness_v1",
                    band: "clear",
                    ratedCriterionCount: 3,
                    notElicitedCriterionCount: 1,
                    unavailableCriterionCount: 1,
                    constraints: [],
                },
                patternGap: {
                    id: "strengthen_evidence_specificity",
                    severity: "medium",
                    upgrade: "Add one concrete detail.",
                    redoPattern: ["direct point", "specific evidence", "useful takeaway"],
                    source: "criterion_appraisal",
                },
            },
            criteriaFacts: [
                {
                    criterionId: "answer_focus",
                    applicability: "observed",
                    band: "clear",
                    reasonCode: "direct_answer",
                },
                {
                    criterionId: "impact_judgment_takeaway",
                    applicability: "not_elicited",
                    band: null,
                    reasonCode: "question_did_not_elicit_impact",
                },
                {
                    criterionId: "organization",
                    applicability: "unscoreable",
                    band: null,
                    reasonCode: "transcription_unclear",
                },
                {
                    criterionId: "evidence_specificity",
                    applicability: "observed",
                    band: "clear",
                    reasonCode: "specificity_clear",
                },
                {
                    criterionId: "role_skill_signal",
                    applicability: "observed",
                    band: "strong",
                    reasonCode: "role_skill_strong",
                },
            ],
            coverage: {
                observedCriteriaIds: ["answer_focus", "evidence_specificity", "role_skill_signal"],
                notElicitedCriteriaIds: ["impact_judgment_takeaway"],
                insufficientDataCriteriaIds: [],
                unscoreableCriteriaIds: ["organization"],
            },
        });
    });

    it("does not expose raw scores, score averages, or a synthetic overall band", () => {
        const facts = createCandidateAnswerCoachingFacts(analysisSnapshot);
        const serializedFacts = JSON.stringify(facts);

        expect(serializedFacts).not.toMatch(/"score"|"averageScore"|"overallRead"|"overallBand"|average/i);
    });

    it("preserves non-observed criteria as coverage context without inventing a weak band", () => {
        const facts = createCandidateAnswerCoachingFacts(createCandidateAnswerAnalysisProviderResultFixture({
            evidenceFirst: {
                criteria: [
                {
                    criterionId: "impact_judgment_takeaway",
                    applicability: "not_elicited",
                    evidenceSpanIds: [],
                    reasonCode: "not_elicited",
                },
                {
                    criterionId: "organization",
                    applicability: "insufficient_data",
                    evidenceSpanIds: [],
                    reasonCode: "insufficient_data",
                },
                ],
            },
        }));

        expect(facts.criteriaFacts).toEqual([
            {
                criterionId: "impact_judgment_takeaway",
                applicability: "not_elicited",
                band: null,
                reasonCode: "not_elicited",
            },
            {
                criterionId: "organization",
                applicability: "insufficient_data",
                band: null,
                reasonCode: "insufficient_data",
            },
        ]);
    });
});
