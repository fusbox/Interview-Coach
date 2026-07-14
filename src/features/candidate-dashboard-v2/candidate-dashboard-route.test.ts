import { describe, expect, it } from "vitest";

import {
    createCandidateDashboardHref,
    normalizeCandidateTargetInterviewId,
} from "./candidate-dashboard-route";

describe("candidate dashboard route contract", () => {
    it("normalizes readable role context into the current temporary target selector", () => {
        expect(normalizeCandidateTargetInterviewId("  Packaging   Associate (2nd Shift) ")).toBe(
            "packaging associate (2nd shift)",
        );
        expect(createCandidateDashboardHref("Packaging Associate (2nd Shift)")).toBe(
            "/candidate/dashboard?targetRole=packaging+associate+%282nd+shift%29",
        );
    });

    it("keeps the bare dashboard route only when no role context exists", () => {
        expect(createCandidateDashboardHref()).toBe("/candidate/dashboard");
        expect(createCandidateDashboardHref("   ")).toBe("/candidate/dashboard");
    });
});
