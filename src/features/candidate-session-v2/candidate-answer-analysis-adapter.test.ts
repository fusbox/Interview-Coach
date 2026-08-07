import { describe, expect, it } from "vitest";

import type { CandidateAnswerAnalysisRequest } from "./candidate-answer-lifecycle";
import {
    createCandidateAnswerEvidenceFirstEvaluationCase,
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

    it("uses the canonical plan count instead of a smaller visit pace in evaluator context", () => {
        const providerRequest = createCandidateAnswerAnalysisProviderRequest({
            request: analysisRequest,
            question,
            setupSnapshot: {
                ...setupSnapshot,
                questionCount: 3,
                canonicalPlanQuestionCount: 7,
            },
        });

        expect(providerRequest.setupContext.questionCount).toBe(7);
    });

    it("evaluates a voice transcript without inventing unavailable delivery markers", () => {
        const providerRequest = createCandidateAnswerAnalysisProviderRequest({
            request: {
                ...analysisRequest,
                answerSubmission: {
                    ...analysisRequest.answerSubmission,
                    mode: "voice",
                    answerAttemptId: "11111111-1111-4111-8111-111111111111",
                    attemptNumber: 1,
                    trigger: "initial_submit",
                    sourceVoiceTranscriptionRunId: "22222222-2222-4222-8222-222222222222",
                    voiceSubmissionPath: "quick_submit",
                    voiceTranscriptEdited: false,
                },
            },
            question,
            setupSnapshot,
        });

        expect(createCandidateAnswerEvidenceFirstEvaluationCase(providerRequest).providerInput).toMatchObject({
            answer: { mode: "voice" },
            voiceMarkers: null,
        });
    });

    it("fails closed when provider output maps to a different answer", () => {
        const providerResult = createEvidenceFirstProviderResult();
        providerResult.answer.slotId = "slot-3";
        providerResult.answer.questionIndex = 2;

        expect(parseCandidateAnswerAnalysisProviderResult(providerResult, analysisRequest)).toBeNull();
    });

    it("fails closed for the retired numeric-evidence-only result shape", () => {
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
            evidence: [{ criterionId: "outcome_impact", applicability: "observed", score: 4 }],
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
            appraisal: {
                answerUsability: { status: "usable" },
                technicalAccuracy: { status: "not_assessed" },
                criteria: expect.arrayContaining([expect.objectContaining({
                    criterionId: "impact_judgment_takeaway",
                    applicability: "observed",
                    band: "emerging",
                })]),
                questionPreparedness: {
                    status: "rated",
                    band: "emerging",
                },
                patternGap: { id: "missing_outcome" },
            },
        });
        expect(result?.evidenceFirst).not.toHaveProperty("feedbackPlan");
        expect(result).not.toHaveProperty("evidence");
    });

    it("reconstructs question preparedness from accepted V2 criterion facts when the stored projection predates it", () => {
        const providerResult = createEvidenceFirstProviderResult();
        delete (providerResult.evidenceFirst.appraisal as Partial<
            typeof providerResult.evidenceFirst.appraisal
        >).questionPreparedness;

        const result = parseCandidateAnswerAnalysisProviderResult(providerResult, {
            ...analysisRequest,
            answerSubmission: {
                ...analysisRequest.answerSubmission,
                answerAttemptId: "11111111-1111-4111-8111-111111111111",
                attemptNumber: 1,
                trigger: "initial_submit",
                supersedesAnswerAttemptId: null,
            },
        });

        expect(result?.evidenceFirst.appraisal.questionPreparedness).toMatchObject({
            status: "rated",
            band: "emerging",
        });
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
        evidenceFirst: {
            contractVersion: "candidate_evidence_first_v2",
            inputFingerprint,
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
            interaction: {
                intervention: "revise_answer",
            },
            appraisal: {
                answerUsability: {
                    status: "usable",
                    reasonCode: "fixture_usable_answer",
                },
                technicalAccuracy: {
                    status: "not_assessed",
                },
                criteria: [
                    "answer_focus",
                    "organization",
                    "evidence_specificity",
                    "role_skill_signal",
                    "impact_judgment_takeaway",
                ].map((criterionId) => ({
                    criterionId,
                    applicability: "observed",
                    band: "emerging",
                    reasonCode: criterionId === "impact_judgment_takeaway"
                        ? "result_not_named"
                        : `fixture_${criterionId}`,
                })),
                questionPreparedness: {
                    status: "rated",
                    policyVersion: "candidate_question_preparedness_v1",
                    band: "emerging",
                    ratedCriterionCount: 5,
                    notElicitedCriterionCount: 0,
                    unavailableCriterionCount: 0,
                    constraints: [],
                },
                patternGap: {
                    id: "missing_outcome",
                    severity: "medium",
                    upgrade: "Add the result of the priority decision.",
                    redoPattern: ["Name the action", "Name the result"],
                    source: "criterion_appraisal",
                },
            },
        },
    };
}
