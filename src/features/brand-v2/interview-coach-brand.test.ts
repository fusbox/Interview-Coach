import { describe, expect, it } from "vitest";

import { resolveInterviewCoachBrand } from "./interview-coach-brand";

describe("interview coach visual brand", () => {
    it("defaults missing and unsupported values to TalentArbor", () => {
        expect(resolveInterviewCoachBrand(undefined)).toMatchObject({
            key: "talentarbor",
            displayName: "TalentArbor",
            logoSrc: "/TA-logo.webp",
        });
        expect(resolveInterviewCoachBrand("unexpected").key).toBe("talentarbor");
    });

    it("selects the NJ Career demo mark explicitly", () => {
        expect(resolveInterviewCoachBrand(" NJCAREERS ")).toMatchObject({
            key: "njcareers",
            displayName: "NJ Career",
            logoSrc: "/njcareer-logo.png",
        });
    });
});
