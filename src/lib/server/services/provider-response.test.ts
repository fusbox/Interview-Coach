import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseProviderJson, parseProviderValue } from "@/lib/server/provider-response";
import { ProviderResponseError } from "@/lib/server/provider-errors";
import {
    GeneratedInterviewQuestionsSchema,
    ResendEmailSendResultSchema,
    StrongResponseResultSchema
} from "@/lib/domain/schemas";

describe("provider response parsing", () => {
    it("throws a typed provider error for invalid JSON", () => {
        expect(() =>
            parseProviderJson("not json", StrongResponseResultSchema, {
                provider: "gemini",
                operation: "generateStrongResponse"
            })
        ).toThrow(ProviderResponseError);
    });

    it("throws a typed provider error for schema-invalid JSON", () => {
        expect(() =>
            parseProviderJson(JSON.stringify({ strongResponse: "valid" }), StrongResponseResultSchema, {
                provider: "gemini",
                operation: "generateStrongResponse"
            })
        ).toThrow(ProviderResponseError);
    });

    it("accepts valid recruiter question generation payloads", () => {
        const result = parseProviderJson(JSON.stringify({
            behavioral: {
                "Conflict/Resolution": "Q1",
                "Adaptability": "Q2",
                "Initiative/Growth": "Q3",
                "Role-Specific Scenario": "Q4"
            },
            culture: {
                "Positive Emotion": "Q5",
                "Engagement": "Q6",
                "Relationships": "Q7",
                "Meaning": "Q8",
                "Accomplishment": "Q9"
            },
            technical: [{ text: "Q10" }]
        }), GeneratedInterviewQuestionsSchema, {
            provider: "gemini",
            operation: "generateQuestions"
        });

        expect(result.technical).toHaveLength(1);
    });

    it("throws a typed provider error for invalid resend payloads", () => {
        expect(() =>
            parseProviderValue({ notId: "123" }, ResendEmailSendResultSchema, {
                provider: "resend",
                operation: "sendInviteEmail"
            })
        ).toThrow(ProviderResponseError);
    });

    it("supports generic schemas for non-empty provider text", () => {
        const result = parseProviderValue("summary text", z.string().min(1), {
            provider: "gemini",
            operation: "summarizeSession"
        });

        expect(result).toBe("summary text");
    });
});
