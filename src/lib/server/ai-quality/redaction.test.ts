import { describe, expect, it } from "vitest";
import { redactPii, redactPiiString } from "./redaction";

describe("redactPii", () => {
    it("redacts common direct identifiers in strings", () => {
        const result = redactPiiString(
            "Pat Lee can be reached at pat.lee@example.com, 555-111-2222, 123-45-6789, or 123 Main St Apt 4.",
            { replacements: [{ value: "Pat Lee", label: "CANDIDATE_NAME" }] }
        );

        expect(result).toBe("[CANDIDATE_NAME] can be reached at [EMAIL], [PHONE], [SSN], or [ADDRESS].");
    });

    it("redacts caller-provided known values", () => {
        const result = redactPiiString("Jordan led the warehouse team.", {
            replacements: [{ value: "Jordan", label: "CANDIDATE_NAME" }]
        });

        expect(result).toBe("[CANDIDATE_NAME] led the warehouse team.");
    });

    it("redacts nested objects and arrays", () => {
        const result = redactPii({
            candidate: {
                email: "pat@example.com",
                notes: ["Call (555) 111-2222", "Lives near 10 Market Road"]
            }
        });

        expect(result).toEqual({
            candidate: {
                email: "[EMAIL]",
                notes: ["Call [PHONE]", "Lives near [ADDRESS]"]
            }
        });
    });

    it("uses structured identifier fields to redact names and locations across nested strings", () => {
        const result = redactPii({
            candidate: {
                firstName: "Fu",
                lastName: "Chen",
                city: "Madison",
                state: "WI",
                zip: "53703",
            },
            transcript: "Fu Chen worked in Madison, WI 53703 before this interview.",
        });

        expect(result).toEqual({
            candidate: {
                firstName: "[FIRST_NAME]",
                lastName: "[LAST_NAME]",
                city: "[LOCATION]",
                state: "[LOCATION]",
                zip: "[LOCATION]",
            },
            transcript: "[CANDIDATE_NAME] worked in [LOCATION] before this interview.",
        });
    });

    it("redacts organization references with common company and institution suffixes", () => {
        const result = redactPiiString("I worked at Brightpath Medical Clinic and Acme Logistics.");

        expect(result).toBe("I worked at [ORGANIZATION] and [ORGANIZATION].");
    });
});
