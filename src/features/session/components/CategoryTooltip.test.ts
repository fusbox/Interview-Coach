import { describe, expect, it } from "vitest";

import { getQuestionCategoryPresentation } from "./question-category-presentation";

describe("question category presentation", () => {
    it.each([
        ["STAR", "Behavioral", "Behavioral"],
        ["Behavioral", "Behavioral", "Behavioral"],
        ["PERMA", "Culture Fit", "Culture Fit"],
        ["Culture", "Culture Fit", "Culture Fit"],
        ["Technical", "Technical", "Technical"],
        ["Tech", "Technical", "Technical"],
        ["Situational", "Scenario", "Scenario"],
        ["Case", "Case", "Case"],
        ["Screening", "Screening", "Screening"],
        ["unknown", "General", "General"],
    ])("maps %s to plain-language chip and tooltip copy", (category, label, title) => {
        expect(getQuestionCategoryPresentation(category)).toMatchObject({
            label,
            title,
        });
    });
});
