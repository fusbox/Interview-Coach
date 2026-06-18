import type { QuestionInput } from "./constants";

type GeneratedQuestionSet = {
    behavioral?: Record<string, unknown>;
    culture?: Record<string, unknown>;
    screening?: Record<string, unknown>;
    technical?: Array<{ text?: unknown }>;
};

export function mapGeneratedQuestionSetToQuestionInputs(data: GeneratedQuestionSet): {
    star: QuestionInput[];
    perma: QuestionInput[];
    technical: QuestionInput[];
} {
    const screeningQuestions = data.screening
        ? Object.entries(data.screening).map(([label, text], index) => ({
            id: `screening-${index + 1}`,
            text: typeof text === "string" ? text : "",
            category: "Screening",
            label,
        }))
        : [];

    const behavioralQuestions = data.behavioral
        ? Object.entries(data.behavioral).map(([label, text], index) => ({
            id: `behavioral-${index + 1}`,
            text: typeof text === "string" ? text : "",
            category: isCaseScenarioLabel(label) ? "Case / Scenario" : "Behavioral",
            label,
        }))
        : [];

    const perma = data.culture
        ? Object.entries(data.culture).map(([label, text], index) => ({
            id: `culture-${index + 1}`,
            text: typeof text === "string" ? text : "",
            category: "Culture / Fit",
            label,
        }))
        : [];

    const technical = data.technical
        ? data.technical.map((question, index) => ({
            id: `tech-${index + 1}`,
            text: typeof question.text === "string" ? question.text : "",
            category: "Technical",
            label: `Technical Q${index + 1}`,
        }))
        : [];

    return {
        star: [...screeningQuestions, ...behavioralQuestions],
        perma,
        technical,
    };
}

function isCaseScenarioLabel(label: string) {
    const normalizedLabel = label.toLowerCase();
    return normalizedLabel.includes("scenario") ||
        normalizedLabel.includes("role-specific") ||
        normalizedLabel.includes("case");
}
