import { describe, expect, it } from "vitest";

import { resolveCategorySignalEvidenceBasis } from "./category-signal-evidence";

describe("resolveCategorySignalEvidenceBasis", () => {
    it("distinguishes exact-span, whole-answer, and absence evidence", () => {
        expect(resolveCategorySignalEvidenceBasis({
            id: "has_context",
            status: "observed",
            evidenceSpanIds: ["span-1"],
        })).toEqual({
            kind: "span",
            evidenceSpanIds: ["span-1"],
        });
        expect(resolveCategorySignalEvidenceBasis({
            id: "has_context",
            status: "observed",
            evidenceSpanIds: [],
        })).toEqual({
            kind: "whole_answer",
            evidenceSpanIds: [],
        });
        expect(resolveCategorySignalEvidenceBasis({
            id: "has_context",
            status: "not_observed",
            evidenceSpanIds: [],
        })).toEqual({
            kind: "absence",
            evidenceSpanIds: [],
        });
    });
});
