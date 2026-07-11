import {
    buildCandidateEvaluationRead,
    deriveCriteriaBand,
    summarizeEvidenceSet,
    type CriteriaBand,
    type EvaluationEvidenceItem,
} from "@/features/evaluation-v2/evaluation-domain";

import type {
    CandidateAnswerAnalysisCoachFeedback,
    CandidateAnswerAnalysisProviderName,
    CandidateAnswerAnalysisProviderResult,
} from "./candidate-answer-analysis-adapter";

export type CandidateAnswerCoachingFact = {
    criterionId: string;
    applicability: EvaluationEvidenceItem["applicability"];
    band: CriteriaBand;
    evidenceState: EvaluationEvidenceItem["applicability"];
};

export type CandidateAnswerCoachingFacts = {
    status: "candidate_answer_coaching_facts";
    provider: CandidateAnswerAnalysisProviderName;
    analyzedAt: string;
    answer: CandidateAnswerAnalysisProviderResult["answer"];
    coachFeedback: CandidateAnswerAnalysisCoachFeedback;
    overallRead: {
        band: CriteriaBand;
        headline: string;
        description: string;
        observedCount: number;
        excludedCount: number;
    };
    criteriaFacts: CandidateAnswerCoachingFact[];
    coverage: {
        observedCriteriaIds: string[];
        notElicitedCriteriaIds: string[];
        insufficientDataCriteriaIds: string[];
        unscoreableCriteriaIds: string[];
    };
};

export function createCandidateAnswerCoachingFacts(
    analysisSnapshot: CandidateAnswerAnalysisProviderResult,
): CandidateAnswerCoachingFacts {
    const evidenceSummary = summarizeEvidenceSet(analysisSnapshot.evidence);
    const overallRead = buildCandidateEvaluationRead({
        label: "Answer coaching",
        evidence: analysisSnapshot.evidence,
    });

    return {
        status: "candidate_answer_coaching_facts",
        provider: analysisSnapshot.provider,
        analyzedAt: analysisSnapshot.analyzedAt,
        answer: analysisSnapshot.answer,
        coachFeedback: analysisSnapshot.coachFeedback,
        overallRead: {
            band: overallRead.band,
            headline: overallRead.headline,
            description: overallRead.description,
            observedCount: evidenceSummary.observedCount,
            excludedCount: evidenceSummary.excludedCount,
        },
        criteriaFacts: analysisSnapshot.evidence.map(toCandidateAnswerCoachingFact),
        coverage: {
            observedCriteriaIds: getCriterionIdsByApplicability(analysisSnapshot.evidence, "observed"),
            notElicitedCriteriaIds: getCriterionIdsByApplicability(analysisSnapshot.evidence, "not_elicited"),
            insufficientDataCriteriaIds: getCriterionIdsByApplicability(analysisSnapshot.evidence, "insufficient_data"),
            unscoreableCriteriaIds: getCriterionIdsByApplicability(analysisSnapshot.evidence, "unscoreable"),
        },
    };
}

function toCandidateAnswerCoachingFact(evidence: EvaluationEvidenceItem): CandidateAnswerCoachingFact {
    return {
        criterionId: evidence.criterionId,
        applicability: evidence.applicability,
        band: evidence.applicability === "observed"
            ? deriveCriteriaBand([evidence])
            : "not_enough_evidence",
        evidenceState: evidence.applicability,
    };
}

function getCriterionIdsByApplicability(
    evidence: EvaluationEvidenceItem[],
    applicability: EvaluationEvidenceItem["applicability"],
) {
    return evidence
        .filter((item) => item.applicability === applicability)
        .map((item) => item.criterionId);
}
