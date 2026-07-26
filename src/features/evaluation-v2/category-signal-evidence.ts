import type { EvidenceExtractionOutput } from "./evidence-first-evaluator-contract";

export type CategorySignalEvidenceBasis =
    | {
        kind: "span";
        evidenceSpanIds: string[];
      }
    | {
        kind: "whole_answer";
        evidenceSpanIds: [];
      }
    | {
        kind: "absence";
        evidenceSpanIds: [];
      }
    | {
        kind: "not_applicable";
        evidenceSpanIds: [];
      }
    | {
        kind: "unscoreable";
        evidenceSpanIds: [];
      };

export function resolveCategorySignalEvidenceBasis(
    signal: EvidenceExtractionOutput["categorySignals"][number],
): CategorySignalEvidenceBasis {
    if (signal.status === "observed") {
        return signal.evidenceSpanIds.length > 0
            ? { kind: "span", evidenceSpanIds: [...signal.evidenceSpanIds] }
            : { kind: "whole_answer", evidenceSpanIds: [] };
    }
    if (signal.status === "not_observed") {
        return { kind: "absence", evidenceSpanIds: [] };
    }
    if (signal.status === "not_applicable") {
        return { kind: "not_applicable", evidenceSpanIds: [] };
    }
    return { kind: "unscoreable", evidenceSpanIds: [] };
}
