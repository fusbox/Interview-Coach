import { describe, expect, it } from "vitest";

import {
    PRACTICE_SETUP_LIMITS,
    parsePracticeSetupInput,
    safeParsePracticeSetupIntakeInput,
    safeParsePracticeSetupInput,
} from "./practice-setup-schema";

describe("practiceSetupSchema", () => {
    it("requires a target role and trims accepted text", () => {
        expect(
            parsePracticeSetupInput({
                targetRole: "  Customer success manager  ",
                jobDescription: "  Support enterprise accounts.  ",
                resumeText: "  Led onboarding programs.  ",
            }),
        ).toEqual({
            targetRole: "Customer success manager",
            jobDescription: "Support enterprise accounts.",
            resumeText: "Led onboarding programs.",
            questionCount: 5,
        });
    });

    it("normalizes missing or blank optional resume context to null", () => {
        expect(parsePracticeSetupInput({
            targetRole: "QA analyst",
            jobDescription: "Test regulated workflows.",
        })).toEqual({
            targetRole: "QA analyst",
            jobDescription: "Test regulated workflows.",
            resumeText: null,
            questionCount: 5,
        });

        expect(
            parsePracticeSetupInput({
                targetRole: "QA analyst",
                jobDescription: " Test regulated workflows. ",
                resumeText: "",
                questionCount: "7",
            }),
        ).toEqual({
            targetRole: "QA analyst",
            jobDescription: "Test regulated workflows.",
            resumeText: null,
            questionCount: 7,
        });
    });

    it("requires job description context for role-specific practice", () => {
        for (const jobDescription of [undefined, null, "   "]) {
            const result = safeParsePracticeSetupInput({
                targetRole: "QA analyst",
                jobDescription,
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.jobDescription).toContain("Job description is required.");
            }
        }
    });

    it("treats question count as lightweight setup configuration", () => {
        expect(parsePracticeSetupInput({
            targetRole: "QA analyst",
            jobDescription: "Test regulated workflows.",
            questionCount: "3",
        })).toMatchObject({
            questionCount: 3,
        });

        expect(safeParsePracticeSetupInput({ targetRole: "QA analyst", jobDescription: "Test regulated workflows.", questionCount: 2 }).success).toBe(false);
        expect(safeParsePracticeSetupInput({ targetRole: "QA analyst", jobDescription: "Test regulated workflows.", questionCount: 11 }).success).toBe(false);
    });

    it("defaults interview stage to not sure yet while preserving legacy interview type as nullable", () => {
        expect(safeParsePracticeSetupIntakeInput({
            confidenceLevel: null,
            interviewType: null,
            interviewStage: null,
            timeline: null,
            concerns: null,
            practiceFocus: [],
        })).toMatchObject({
            success: true,
            data: expect.objectContaining({
                interviewType: null,
                interviewStage: "not_sure",
            }),
        });

        expect(safeParsePracticeSetupIntakeInput({
            confidenceLevel: null,
            interviewType: "behavioral",
            interviewStage: "follow_up_final",
            timeline: null,
            concerns: null,
            practiceFocus: [],
        })).toMatchObject({
            success: true,
            data: expect.objectContaining({
                interviewType: "behavioral",
                interviewStage: "follow_up_final",
            }),
        });
    });

    it("rejects blank target role values", () => {
        const result = safeParsePracticeSetupInput({
            targetRole: "   ",
            jobDescription: "Optional context",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.targetRole).toContain("Target role is required.");
        }
    });

    it("rejects invalid payload shapes before the service boundary", () => {
        expect(safeParsePracticeSetupInput({ targetRole: 42 }).success).toBe(false);
        expect(safeParsePracticeSetupInput({ targetRole: "Designer", jobDescription: "Design accessible products.", resumeText: 42 }).success).toBe(false);
    });

    it("enforces field length limits for setup payloads", () => {
        const targetRole = "a".repeat(PRACTICE_SETUP_LIMITS.targetRole + 1);
        const jobDescription = "a".repeat(PRACTICE_SETUP_LIMITS.jobDescription + 1);
        const resumeText = "a".repeat(PRACTICE_SETUP_LIMITS.resumeText + 1);

        expect(safeParsePracticeSetupInput({ targetRole }).success).toBe(false);
        expect(safeParsePracticeSetupInput({ targetRole: "Designer", jobDescription }).success).toBe(false);
        expect(safeParsePracticeSetupInput({ targetRole: "Designer", jobDescription: "Design accessible products.", resumeText }).success).toBe(false);
    });
});
