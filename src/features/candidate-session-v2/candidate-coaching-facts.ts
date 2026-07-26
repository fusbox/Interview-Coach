import type {
    CandidateAnswerAnalysisCoachFeedback,
    CandidateAnswerAnalysisProviderName,
    CandidateAnswerAnalysisProviderResult,
    CandidateEvidenceFirstCriterionAppraisal,
} from "./candidate-answer-analysis-adapter";

export type CandidateAnswerCoachingFact = {
    criterionId: CandidateEvidenceFirstCriterionAppraisal["criterionId"];
    applicability: CandidateEvidenceFirstCriterionAppraisal["applicability"];
    band: CandidateEvidenceFirstCriterionAppraisal["band"] | null;
    reasonCode: string;
};

export type CandidateAnswerCoachingFacts = {
    status: "candidate_answer_coaching_facts";
    provider: CandidateAnswerAnalysisProviderName;
    analyzedAt: string;
    answer: CandidateAnswerAnalysisProviderResult["answer"];
    coachFeedback: CandidateAnswerAnalysisCoachFeedback;
    supportedStrength: string | null;
    interaction: {
        intervention: CandidateAnswerAnalysisProviderResult["evidenceFirst"]["interaction"]["intervention"];
        posture: "move_on" | "polish" | "remediate";
    };
    appraisal: {
        answerUsability: CandidateAnswerAnalysisProviderResult["evidenceFirst"]["appraisal"]["answerUsability"];
        technicalAccuracy: CandidateAnswerAnalysisProviderResult["evidenceFirst"]["appraisal"]["technicalAccuracy"];
        questionPreparedness: CandidateAnswerAnalysisProviderResult["evidenceFirst"]["appraisal"]["questionPreparedness"];
        patternGap: CandidateAnswerAnalysisProviderResult["evidenceFirst"]["appraisal"]["patternGap"];
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
    const appraisal = analysisSnapshot.evidenceFirst.appraisal;

    return {
        status: "candidate_answer_coaching_facts",
        provider: analysisSnapshot.provider,
        analyzedAt: analysisSnapshot.analyzedAt,
        answer: analysisSnapshot.answer,
        coachFeedback: analysisSnapshot.coachFeedback,
        supportedStrength: analysisSnapshot.evidenceFirst.candidateFeedback.primaryStrength,
        interaction: {
            intervention: analysisSnapshot.evidenceFirst.interaction.intervention,
            posture: coachingPostureForIntervention(analysisSnapshot.evidenceFirst.interaction.intervention),
        },
        appraisal: {
            answerUsability: appraisal.answerUsability,
            technicalAccuracy: appraisal.technicalAccuracy,
            questionPreparedness: appraisal.questionPreparedness,
            patternGap: appraisal.patternGap,
        },
        criteriaFacts: appraisal.criteria.map((criterion) => ({
            criterionId: criterion.criterionId,
            applicability: criterion.applicability,
            band: criterion.band ?? null,
            reasonCode: criterion.reasonCode,
        })),
        coverage: {
            observedCriteriaIds: getCriterionIdsByApplicability(appraisal.criteria, "observed"),
            notElicitedCriteriaIds: getCriterionIdsByApplicability(appraisal.criteria, "not_elicited"),
            insufficientDataCriteriaIds: getCriterionIdsByApplicability(appraisal.criteria, "insufficient_data"),
            unscoreableCriteriaIds: getCriterionIdsByApplicability(appraisal.criteria, "unscoreable"),
        },
    };
}

function coachingPostureForIntervention(
    intervention: CandidateAnswerAnalysisProviderResult["evidenceFirst"]["interaction"]["intervention"],
): CandidateAnswerCoachingFacts["interaction"]["posture"] {
    if (intervention === "affirm_and_continue") return "move_on";
    if (intervention === "polish_then_continue") return "polish";
    return "remediate";
}

function getCriterionIdsByApplicability(
    criteria: CandidateEvidenceFirstCriterionAppraisal[],
    applicability: CandidateEvidenceFirstCriterionAppraisal["applicability"],
) {
    return criteria
        .filter((criterion) => criterion.applicability === applicability)
        .map((criterion) => criterion.criterionId);
}
