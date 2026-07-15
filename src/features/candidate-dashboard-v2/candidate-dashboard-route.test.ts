import { describe, expect, it } from "vitest";

import {
    createCandidateDashboardHref,
    normalizeCandidateRoleProfileId,
    normalizeCandidateTargetInterviewId,
} from "./candidate-dashboard-route";

describe("candidate dashboard route contract", () => {
    it("uses an opaque prep-context id as the canonical selector", () => {
        expect(normalizeCandidateRoleProfileId("  AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA ")).toBe(
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        );
        expect(createCandidateDashboardHref({
            roleProfileId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
        })).toBe("/candidate/dashboard?prep=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    });

    it("keeps readable role selection only as an explicit legacy route", () => {
        expect(normalizeCandidateTargetInterviewId("  Packaging   Associate (2nd Shift) ")).toBe(
            "packaging associate (2nd shift)",
        );
        expect(createCandidateDashboardHref({ legacyTargetRole: "Packaging Associate (2nd Shift)" })).toBe(
            "/candidate/dashboard?targetRole=packaging+associate+%282nd+shift%29",
        );
    });

    it("fails malformed selectors back to the bare dashboard route", () => {
        expect(createCandidateDashboardHref()).toBe("/candidate/dashboard");
        expect(createCandidateDashboardHref({ roleProfileId: "not-a-profile-id" })).toBe("/candidate/dashboard");
        expect(createCandidateDashboardHref({ legacyTargetRole: "   " })).toBe("/candidate/dashboard");
        expect(normalizeCandidateRoleProfileId("not-a-profile-id")).toBeNull();
    });
});
