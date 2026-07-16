import { describe, expect, it } from "vitest";

import type { CandidateAnswerAnalysisRequest } from "./candidate-answer-lifecycle";
import {
    createCandidateAnswerAnalysisProviderRequest,
    parseCandidateAnswerAnalysisProviderResult,
} from "./candidate-answer-analysis-adapter";

const analysisRequest: CandidateAnswerAnalysisRequest = {
    status: "answer_analysis_requested",
    requestedAt: "2026-07-10T15:01:00.000Z",
    answerSubmission: {
        slotId: "slot-2",
        questionIndex: 1,
        mode: "text",
        text: "I checked the order list first, then asked my supervisor which shipment had priority.",
        submittedAt: "2026-07-10T15:00:00.000Z",
        status: "pending_analysis",
    },
};

const question = {
    slotId: "slot-2",
    index: 1,
    category: "behavioral" as const,
    questionText: "Tell me about a time you had to prioritize similar work.",
};

const setupSnapshot = {
    targetRole: "Material Handler I",
    jobDescription: "Move materials, maintain inventory, and support shipping.",
    resumeText: null,
    interviewStage: "first_interview" as const,
    questionCount: 7,
    resumeCaptureMode: "none" as const,
    createdAt: "2026-07-10T14:55:00.000Z",
};

const inputFingerprint = "a".repeat(64);

describe("candidate answer analysis adapter", () => {
    it("creates a provider request from the saved answer, question wording, and setup context", () => {
        expect(createCandidateAnswerAnalysisProviderRequest({
            request: analysisRequest,
            question,
            setupSnapshot,
        })).toEqual({
            status: "answer_analysis_provider_requested",
            provider: "candidate_v2_answer_evaluator",
            requestedAt: "2026-07-10T15:01:00.000Z",
            answer: {
                slotId: "slot-2",
                questionIndex: 1,
                mode: "text",
                text: "I checked the order list first, then asked my supervisor which shipment had priority.",
                submittedAt: "2026-07-10T15:00:00.000Z",
            },
            question: {
                slotId: "slot-2",
                questionIndex: 1,
                category: "behavioral",
                questionText: "Tell me about a time you had to prioritize similar work.",
                plannedPurpose: "Real past examples that show what you personally did and what changed.",
            },
            setupContext: {
                targetRole: "Material Handler I",
                jobDescription: "Move materials, maintain inventory, and support shipping.",
                resumeText: null,
                interviewStage: "first_interview",
                questionCount: 7,
            },
        });
    });

    it("rejects a provider request when the question does not match the submitted answer slot", () => {
        expect(() => createCandidateAnswerAnalysisProviderRequest({
            request: analysisRequest,
            question: {
                ...question,
                slotId: "slot-3",
            },
            setupSnapshot,
        })).toThrow("Answer analysis provider request must map to the submitted answer slot.");
    });

    it("parses provider results that map back to the requested answer and evidence contract", () => {
        expect(parseCandidateAnswerAnalysisProviderResult({
            status: "answer_analysis_provider_result",
            provider: "candidate_v2_answer_evaluator",
            analyzedAt: "2026-07-10T15:02:00.000Z",
            answer: {
                slotId: "slot-2",
                questionIndex: 1,
            },
            coachFeedback: {
                acknowledgement: "You named a practical first step.",
                observation: "The answer would be stronger with the result of your choice.",
                nextPracticeFocus: "Add what changed after you set the priority.",
            },
            evidence: [
                {
                    criterionId: "answer_specificity",
                    applicability: "observed",
                    score: 3,
                },
                {
                    criterionId: "outcome_impact",
                    applicability: "not_elicited",
                },
            ],
        }, analysisRequest)).toEqual({
            status: "answer_analysis_provider_result",
            provider: "candidate_v2_answer_evaluator",
            analyzedAt: "2026-07-10T15:02:00.000Z",
            answer: {
                slotId: "slot-2",
                questionIndex: 1,
            },
            coachFeedback: {
                acknowledgement: "You named a practical first step.",
                observation: "The answer would be stronger with the result of your choice.",
                nextPracticeFocus: "Add what changed after you set the priority.",
            },
            evidence: [
                {
                    criterionId: "answer_specificity",
                    applicability: "observed",
                    score: 3,
                },
                {
                    criterionId: "outcome_impact",
                    applicability: "not_elicited",
                },
            ],
        });
    });

    it("fails closed when provider output maps to a different answer", () => {
        expect(parseCandidateAnswerAnalysisProviderResult({
            status: "answer_analysis_provider_result",
            provider: "candidate_v2_answer_evaluator",
            analyzedAt: "2026-07-10T15:02:00.000Z",
            answer: {
                slotId: "slot-3",
                questionIndex: 2,
            },
            coachFeedback: {
                acknowledgement: "You named a practical first step.",
                observation: "The answer would be stronger with the result of your choice.",
                nextPracticeFocus: "Add what changed after you set the priority.",
            },
            evidence: [],
        }, analysisRequest)).toBeNull();
    });

    it("fails closed when excluded evidence carries a numeric score", () => {
        expect(parseCandidateAnswerAnalysisProviderResult({
            status: "answer_analysis_provider_result",
            provider: "candidate_v2_answer_evaluator",
            analyzedAt: "2026-07-10T15:02:00.000Z",
            answer: {
                slotId: "slot-2",
                questionIndex: 1,
            },
            coachFeedback: {
                acknowledgement: "You named a practical first step.",
                observation: "The answer would be stronger with the result of your choice.",
                nextPracticeFocus: "Add what changed after you set the priority.",
            },
            evidence: [
                {
                    criterionId: "outcome_impact",
                    applicability: "not_elicited",
                    score: 1,
                },
            ],
        }, analysisRequest)).toBeNull();
    });

    it("accepts a candidate-safe evidence-first projection for the exact answer attempt", () => {
        const attemptRequest: CandidateAnswerAnalysisRequest = {
            ...analysisRequest,
            answerSubmission: {
                ...analysisRequest.answerSubmission,
                answerAttemptId: "11111111-1111-4111-8111-111111111111",
                attemptNumber: 1,
                trigger: "initial_submit",
                supersedesAnswerAttemptId: null,
            },
        };
        const result = parseCandidateAnswerAnalysisProviderResult(
            createEvidenceFirstProviderResult(),
            attemptRequest,
        );

        expect(result).toMatchObject({
            answer: {
                answerAttemptId: "11111111-1111-4111-8111-111111111111",
                attemptNumber: 1,
                trigger: "initial_submit",
            },
            evidenceFirst: {
                contractVersion: "candidate_evidence_first_v2",
                inputFingerprint,
                candidateFeedback: {
                    status: "candidate_safe_feedback",
                    biggestUpgrade: "Add what changed after you set the priority.",
                },
            },
        });
        expect(result?.evidenceFirst).toMatchObject({
            interaction: { intervention: "revise_answer" },
        });
        expect(result?.evidenceFirst).not.toHaveProperty("feedbackPlan");
        expect(result?.evidenceFirst).not.toHaveProperty("criteria");
        expect(result?.evidenceFirst).not.toHaveProperty("patternGap");
    });

    it("fails closed when evidence-first feedback has a different input fingerprint", () => {
        const providerResult = createEvidenceFirstProviderResult();
        providerResult.evidenceFirst.candidateFeedback.inputFingerprint = "b".repeat(64);

        expect(parseCandidateAnswerAnalysisProviderResult(providerResult, {
            ...analysisRequest,
            answerSubmission: {
                ...analysisRequest.answerSubmission,
                answerAttemptId: "11111111-1111-4111-8111-111111111111",
                attemptNumber: 1,
                trigger: "initial_submit",
                supersedesAnswerAttemptId: null,
            },
        })).toBeNull();
    });
});

function createEvidenceFirstProviderResult() {
    return {
        status: "answer_analysis_provider_result",
        provider: "candidate_v2_answer_evaluator",
        analyzedAt: "2026-07-10T15:02:00.000Z",
        answer: {
            slotId: "slot-2",
            questionIndex: 1,
            answerAttemptId: "11111111-1111-4111-8111-111111111111",
            attemptNumber: 1,
            trigger: "initial_submit",
        },
        coachFeedback: {
            acknowledgement: "You named a practical first step.",
            observation: "The answer would be stronger with the result of your choice.",
            nextPracticeFocus: "Add what changed after you set the priority.",
        },
        evidence: [],
        evidenceFirst: {
            contractVersion: "candidate_evidence_first_v2",
            inputFingerprint,
            feedbackPlan: {
                centralRead: "The answer explains the action but not the result.",
                signal: { valence: "mixed", detectability: "moderate" },
                primaryAnchor: { kind: "pattern_gap", id: "missing_outcome" },
                intervention: "revise_answer",
            },
            candidateFeedback: {
                status: "candidate_safe_feedback",
                schemaVersion: 1,
                inputFingerprint,
                acknowledgement: "You named a practical first step.",
                primaryStrength: "You explained how you set the priority.",
                biggestUpgrade: "Add what changed after you set the priority.",
                redoPrompt: "Try it again and finish with the result.",
                patternSuggestion: {
                    patternName: "Action and result",
                    steps: ["Name the action", "Name the result"],
                },
                deliveryNote: null,
            },
            criteria: [{
                criterionId: "impact_judgment_takeaway",
                applicability: "observed",
                band: "emerging",
                evidenceSpanIds: ["span-1"],
                reasonCode: "result_not_named",
            }],
            patternGap: {
                id: "missing_outcome",
                severity: "medium",
                upgrade: "Add the result of the priority decision.",
                redoPattern: ["Name the action", "Name the result"],
                source: "criterion_appraisal",
            },
        },
    };
}
