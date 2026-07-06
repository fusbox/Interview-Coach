export type EvaluationCriterionId = string;

export type EvidenceApplicability = "observed" | "not_elicited" | "insufficient_data" | "unscoreable";

export type CriteriaBand = "not_enough_evidence" | "emerging" | "clear" | "strong";

export type EvaluationEvidenceItem = {
    criterionId: EvaluationCriterionId;
    applicability: EvidenceApplicability;
    score?: number;
};

export type EvaluationEvidenceSummary = {
    band: CriteriaBand;
    observedCount: number;
    excludedCount: number;
    averageScore?: number;
};

export type CandidateEvaluationRead = {
    label: string;
    band: CriteriaBand;
    headline: string;
    description: string;
};

const bandCopy: Record<CriteriaBand, Pick<CandidateEvaluationRead, "headline" | "description">> = {
    not_enough_evidence: {
        headline: "More practice needed",
        description: "The coach needs more answer evidence before showing a pattern.",
    },
    emerging: {
        headline: "Emerging evidence",
        description: "The practiced answer gives the coach early evidence and a useful place to strengthen.",
    },
    clear: {
        headline: "Clear evidence",
        description: "The practiced answer gives the coach enough evidence to show a clear pattern.",
    },
    strong: {
        headline: "Strong evidence",
        description: "The practiced answer gives the coach consistent evidence to keep building from.",
    },
};

function getObservedScores(evidence: EvaluationEvidenceItem[]): number[] {
    return evidence
        .filter((item) => item.applicability === "observed")
        .map((item) => item.score)
        .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
}

export function deriveCriteriaBand(evidence: EvaluationEvidenceItem[]): CriteriaBand {
    const scores = getObservedScores(evidence);

    if (scores.length === 0) {
        return "not_enough_evidence";
    }

    const averageScore = scores.reduce((total, score) => total + score, 0) / scores.length;

    if (averageScore >= 4) {
        return "strong";
    }

    if (averageScore >= 3) {
        return "clear";
    }

    return "emerging";
}

export function summarizeEvidenceSet(evidence: EvaluationEvidenceItem[]): EvaluationEvidenceSummary {
    const observedScores = getObservedScores(evidence);
    const averageScore =
        observedScores.length > 0
            ? observedScores.reduce((total, score) => total + score, 0) / observedScores.length
            : undefined;

    return {
        band: deriveCriteriaBand(evidence),
        observedCount: observedScores.length,
        excludedCount: evidence.length - observedScores.length,
        ...(averageScore === undefined ? {} : { averageScore }),
    };
}

export function buildCandidateEvaluationRead(input: {
    label: string;
    evidence: EvaluationEvidenceItem[];
}): CandidateEvaluationRead {
    const band = deriveCriteriaBand(input.evidence);
    const copy = bandCopy[band];

    return {
        label: input.label,
        band,
        headline: copy.headline,
        description: copy.description,
    };
}
