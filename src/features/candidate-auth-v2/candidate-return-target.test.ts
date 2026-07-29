import { describe, expect, it } from "vitest";

import { resolveCandidateReturnTarget } from "./candidate-return-target";

describe("candidate return target", () => {
    it("accepts only bounded authenticated candidate product routes", () => {
        expect(resolveCandidateReturnTarget("/candidate")).toBe("/candidate");
        expect(resolveCandidateReturnTarget("/candidate/dashboard?prep=abc"))
            .toBe("/candidate/dashboard?prep=abc");
        expect(resolveCandidateReturnTarget("/candidate/session/session-1"))
            .toBe("/candidate/session/session-1");
    });

    it.each([
        undefined,
        "https://example.com/candidate/dashboard",
        "//example.com/candidate/dashboard",
        "/recruiter/dashboard",
        "/candidate/login",
        "/candidate/launch?token=secret",
        "/candidate/invited",
    ])("falls back for unsafe or identity-entry targets", (value) => {
        expect(resolveCandidateReturnTarget(value)).toBe("/candidate");
    });
});
