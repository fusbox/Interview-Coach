import { describe, expect, it } from "vitest";
import {
    buildCandidateEvaluationRead,
    deriveCriteriaBand,
    summarizeEvidenceSet,
    type EvaluationEvidenceItem,
} from "./evaluation-domain";

describe("evaluation V2 domain contracts", () => {
    it("maps observed scored evidence into qualitative criteria bands", () => {
        expect(deriveCriteriaBand([{ criterionId: "specificity", applicability: "observed", score: 1.8 }])).toBe(
            "emerging",
        );
        expect(deriveCriteriaBand([{ criterionId: "specificity", applicability: "observed", score: 3.25 }])).toBe(
            "clear",
        );
        expect(deriveCriteriaBand([{ criterionId: "specificity", applicability: "observed", score: 4.4 }])).toBe(
            "strong",
        );
    });

    it("treats missing or non-observed evidence as not enough evidence instead of weak performance", () => {
        const evidence: EvaluationEvidenceItem[] = [
            { criterionId: "signposting", applicability: "not_elicited" },
            { criterionId: "resilience", applicability: "insufficient_data" },
            { criterionId: "filler_words", applicability: "unscoreable" },
        ];

        expect(deriveCriteriaBand(evidence)).toBe("not_enough_evidence");
        expect(summarizeEvidenceSet(evidence)).toMatchObject({
            observedCount: 0,
            excludedCount: 3,
            band: "not_enough_evidence",
        });
    });

    it("excludes non-observed criteria from the band average", () => {
        const evidence: EvaluationEvidenceItem[] = [
            { criterionId: "specificity", applicability: "observed", score: 4.5 },
            { criterionId: "signposting", applicability: "not_elicited" },
            { criterionId: "resilience", applicability: "unscoreable" },
        ];

        expect(summarizeEvidenceSet(evidence)).toEqual({
            band: "strong",
            observedCount: 1,
            excludedCount: 2,
            averageScore: 4.5,
        });
    });

    it("keeps candidate-facing reads qualitative and free of numeric score claims", () => {
        const read = buildCandidateEvaluationRead({
            label: "Answer substance",
            evidence: [
                { criterionId: "focus_relevance", applicability: "observed", score: 3.4 },
                { criterionId: "specificity_concreteness", applicability: "observed", score: 3.8 },
            ],
        });

        expect(read).toEqual({
            label: "Answer substance",
            band: "clear",
            headline: "Clear evidence",
            description: "The practiced answer gives the coach enough evidence to show a clear pattern.",
        });
        expect(JSON.stringify(read)).not.toMatch(/\b3(?:\.\d+)?\b|\b4(?:\.\d+)?\b|score/i);
    });
});
