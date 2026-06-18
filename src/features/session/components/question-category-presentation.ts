export type QuestionCategoryPresentation = {
    label: string;
    title: string;
    description: string;
};

const CATEGORY_DEFINITIONS: Record<string, QuestionCategoryPresentation> = {
    STAR: {
        label: "Behavioral",
        title: "Behavioral",
        description: "Questions about past experiences, choices, actions, and results.",
    },
    BEHAVIORAL: {
        label: "Behavioral",
        title: "Behavioral",
        description: "Questions about past experiences, choices, actions, and results.",
    },
    CULTURE_FIT: {
        label: "Culture Fit",
        title: "Culture Fit",
        description: "Questions about motivation, work style, values, and how you show up with a team.",
    },
    PERMA: {
        label: "Culture Fit",
        title: "Culture Fit",
        description: "Questions about motivation, work style, values, and how you show up with a team.",
    },
    CULTURE: {
        label: "Culture Fit",
        title: "Culture Fit",
        description: "Questions about motivation, work style, values, and how you show up with a team.",
    },
    TECHNICAL: {
        label: "Technical",
        title: "Technical",
        description: "Questions about role-specific skills, tools, processes, or domain knowledge.",
    },
    TECHNICAL_ROLE_SPECIFIC: {
        label: "Technical",
        title: "Technical",
        description: "Questions about role-specific skills, tools, processes, or domain knowledge.",
    },
    TECH: {
        label: "Technical",
        title: "Technical",
        description: "Questions about role-specific skills, tools, processes, or domain knowledge.",
    },
    CASE_SCENARIO: {
        label: "Scenario",
        title: "Scenario",
        description: "Questions about how you would handle a realistic workplace situation.",
    },
    SITUATIONAL: {
        label: "Scenario",
        title: "Scenario",
        description: "Questions about how you would handle a realistic workplace situation.",
    },
    SCENARIO: {
        label: "Scenario",
        title: "Scenario",
        description: "Questions about how you would handle a realistic workplace situation.",
    },
    CASE: {
        label: "Case",
        title: "Case",
        description: "Questions that ask you to reason through a problem, tradeoff, or decision.",
    },
    SCREENING: {
        label: "Screening",
        title: "Screening",
        description: "Questions that cover role fit, background, availability, or basic qualifications.",
    },
    OTHER: {
        label: "General",
        title: "General",
        description: "General interview questions and conversation starters.",
    },
};

export function getQuestionCategoryPresentation(category: string): QuestionCategoryPresentation {
    const upperCategory = category.trim().toUpperCase().replace(/[\s/-]+/g, "_");

    return CATEGORY_DEFINITIONS[upperCategory] || CATEGORY_DEFINITIONS.OTHER;
}
