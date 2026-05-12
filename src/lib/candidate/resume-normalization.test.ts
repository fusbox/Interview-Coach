import { describe, expect, it } from "vitest";

import {
    MAX_NORMALIZED_RESUME_TEXT_LENGTH,
    normalizeResumeText,
} from "./resume-normalization";

describe("normalizeResumeText", () => {
    it("normalizes whitespace while preserving meaningful line breaks", () => {
        expect(normalizeResumeText("  Led\t\tQA releases\r\n\r\n\r\nReduced\u00a0defects by 30%  ")).toBe(
            "Led QA releases\n\nReduced defects by 30%",
        );
    });

    it("returns null for empty or whitespace-only resume text", () => {
        expect(normalizeResumeText("")).toBeNull();
        expect(normalizeResumeText(" \t \r\n ")).toBeNull();
    });

    it("preserves unusual resume symbols and punctuation candidates may paste", () => {
        expect(normalizeResumeText("Skills: C#, SQL, A/B testing, 95% SLA, \u2022 coaching")).toBe(
            "Skills: C#, SQL, A/B testing, 95% SLA, \u2022 coaching",
        );
    });

    it("rejects normalized resume text above the supported length", () => {
        expect(() => normalizeResumeText("a".repeat(MAX_NORMALIZED_RESUME_TEXT_LENGTH + 1))).toThrow(
            `Resume text must be ${MAX_NORMALIZED_RESUME_TEXT_LENGTH.toLocaleString()} characters or fewer.`,
        );
    });
});
