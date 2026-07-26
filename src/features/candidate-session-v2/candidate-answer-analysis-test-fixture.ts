import {
    EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
    type CandidateSafeFeedbackProjection,
    type CriterionAppraisal,
    type EvidenceExtractionOutput,
    type PatternGap,
} from "@/features/evaluation-v2/evidence-first-evaluator-contract";
import { deriveQuestionPreparedness } from "@/features/evaluation-v2/question-preparedness";

import type {
    CandidateAnswerAnalysisProviderResult,
    CandidateEvidenceFirstAnalysisSnapshot,
} from "./candidate-answer-analysis-adapter";

const defaultCriteria: CriterionAppraisal[] = [
    "answer_focus",
    "organization",
    "evidence_specificity",
    "role_skill_signal",
    "impact_judgment_takeaway",
].map((criterionId) => ({
    criterionId: criterionId as CriterionAppraisal["criterionId"],
    applicability: "observed",
    band: "clear",
    evidenceSpanIds: [],
    reasonCode: `fixture_${criterionId}_clear`,
}));

export function createCandidateEvidenceFirstAnalysisSnapshotFixture(input: {
    inputFingerprint?: string;
    candidateFeedback?: Partial<CandidateSafeFeedbackProjection>;
    answerUsability?: EvidenceExtractionOutput["answerUsability"];
    technicalAccuracyStatus?: EvidenceExtractionOutput["technicalAccuracy"]["status"];
    criteria?: CriterionAppraisal[];
    patternGap?: PatternGap;
    intervention?: CandidateEvidenceFirstAnalysisSnapshot["interaction"]["intervention"];
} = {}): CandidateEvidenceFirstAnalysisSnapshot {
    const inputFingerprint = input.inputFingerprint ?? "a".repeat(64);
    const answerUsability = input.answerUsability ?? {
        status: "usable" as const,
        reasonCode: "fixture_usable_answer",
    };
    const technicalAccuracy = {
        status: input.technicalAccuracyStatus ?? "not_assessed" as const,
    };
    const criteria = input.criteria ?? defaultCriteria;
    return {
        contractVersion: EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
        inputFingerprint,
        candidateFeedback: {
            status: "candidate_safe_feedback",
            schemaVersion: 1,
            inputFingerprint,
            acknowledgement: "You gave a direct response.",
            primaryStrength: "You kept the answer connected to the question.",
            biggestUpgrade: "Add one concrete supporting detail.",
            redoPrompt: "Try it again with one concrete supporting detail.",
            patternSuggestion: null,
            deliveryNote: null,
            ...input.candidateFeedback,
        },
        interaction: {
            intervention: input.intervention ?? "revise_answer",
        },
        appraisal: {
            answerUsability,
            technicalAccuracy,
            criteria: criteria.map((criterion) => ({
                criterionId: criterion.criterionId,
                applicability: criterion.applicability,
                ...(criterion.band ? { band: criterion.band } : {}),
                reasonCode: criterion.reasonCode,
            })),
            questionPreparedness: deriveQuestionPreparedness({
                answerUsability,
                technicalAccuracy,
                criteria,
            }),
            patternGap: input.patternGap ?? {
                id: "strengthen_evidence_specificity",
                severity: "medium",
                upgrade: "Add one concrete detail.",
                redoPattern: ["direct point", "specific evidence", "useful takeaway"],
                source: "criterion_appraisal",
            },
        },
    };
}

export function createCandidateAnswerAnalysisProviderResultFixture(input: {
    analyzedAt?: string;
    answer?: Partial<CandidateAnswerAnalysisProviderResult["answer"]>;
    coachFeedback?: Partial<CandidateAnswerAnalysisProviderResult["coachFeedback"]>;
    evidenceFirst?: Parameters<typeof createCandidateEvidenceFirstAnalysisSnapshotFixture>[0];
} = {}): CandidateAnswerAnalysisProviderResult {
    return {
        status: "answer_analysis_provider_result",
        provider: "candidate_v2_answer_evaluator",
        analyzedAt: input.analyzedAt ?? "2026-07-24T12:00:00.000Z",
        answer: {
            slotId: "slot-1",
            questionIndex: 0,
            ...input.answer,
        },
        coachFeedback: {
            acknowledgement: "You gave a direct response.",
            observation: "Your answer stayed connected to the question.",
            nextPracticeFocus: "Add one concrete supporting detail.",
            ...input.coachFeedback,
        },
        evidenceFirst: createCandidateEvidenceFirstAnalysisSnapshotFixture(input.evidenceFirst),
    };
}
