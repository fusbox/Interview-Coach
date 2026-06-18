import { describe, expect, it } from "vitest";

import { mapGeneratedQuestionSetToQuestionInputs } from "./question-generation-mapper";

describe("mapGeneratedQuestionSetToQuestionInputs", () => {
    it("preserves repaired extra case-scenario questions for planned recruiter question setup", () => {
        const result = mapGeneratedQuestionSetToQuestionInputs({
            behavioral: {
                "Conflict/Resolution": "Tell me about a time you calmed down an upset client.",
                "Adaptability": "Tell me about a time priorities changed quickly.",
                "Initiative/Growth": "Tell me about a time you improved a client support process.",
                "Role-Specific Scenario": "A client needs help while another task is urgent. What do you do first?",
                "Role-Specific Scenario 2": "Imagine a Client Service Coordinator has two urgent client requests at once. What do you do first?",
            },
            culture: {
                "Positive Emotion": "What helps you stay positive during client-facing work?",
            },
            screening: {
                "Interest": "Why are you interested in this client service role?",
            },
            technical: [
                { text: "How do you document client issues in a CRM?" },
            ],
        });

        expect(result.star.filter((question) => question.category === "Case / Scenario")).toEqual([
            expect.objectContaining({
                label: "Role-Specific Scenario",
                text: "A client needs help while another task is urgent. What do you do first?",
            }),
            expect.objectContaining({
                label: "Role-Specific Scenario 2",
                text: "Imagine a Client Service Coordinator has two urgent client requests at once. What do you do first?",
            }),
        ]);
        expect(result.star).toEqual(expect.arrayContaining([
            expect.objectContaining({
                category: "Screening",
                label: "Interest",
            }),
            expect.objectContaining({
                category: "Behavioral",
                label: "Conflict/Resolution",
            }),
        ]));
        expect(result.perma).toHaveLength(1);
        expect(result.technical).toHaveLength(1);
    });
});
