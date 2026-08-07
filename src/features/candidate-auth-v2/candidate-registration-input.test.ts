import { describe, expect, it } from "vitest";

import {
    formatCandidatePhoneInput,
    sanitizeCandidateEmailInput,
    sanitizeCandidatePostalCodeInput,
} from "./candidate-registration-input";

describe("candidate registration input", () => {
    it("removes email whitespace without changing the candidate-entered casing", () => {
        expect(sanitizeCandidateEmailInput(" Sam @Example.com ")).toBe("Sam@Example.com");
    });

    it("formats bounded US phone input and preserves explicit international input", () => {
        expect(formatCandidatePhoneInput("3125550100")).toBe("(312) 555-0100");
        expect(formatCandidatePhoneInput("1 (312) 555-0100")).toBe("(312) 555-0100");
        expect(formatCandidatePhoneInput("+44 20 7946 0958")).toBe("+442079460958");
        expect(formatCandidatePhoneInput("312-CALL-NOW")).toBe("312");
        expect(formatCandidatePhoneInput("+12345678901234567890")).toBe("+123456789012345");
    });

    it("keeps ZIP input numeric, five characters long, and leading-zero safe", () => {
        expect(sanitizeCandidatePostalCodeInput("02134-9999")).toBe("02134");
        expect(sanitizeCandidatePostalCodeInput("60A6B0C1")).toBe("60601");
    });
});
