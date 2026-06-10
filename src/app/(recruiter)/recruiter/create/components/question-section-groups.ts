import type { QuestionInput } from "../constants";
import type { QuestionPlanCategory } from "@/lib/domain/question-plan";

export const questionPlanCategoryLabels: Record<QuestionPlanCategory, string> = {
    screening: "Screening",
    behavioral: "Behavioral",
    culture_fit: "Culture / Fit",
    case_scenario: "Case / Scenario",
    technical_role_specific: "Technical / Role-Specific",
};

export function isScreeningQuestion(question: QuestionInput): boolean {
    return question.category.toLowerCase() === "screening";
}

export function isCaseScenarioQuestion(question: QuestionInput): boolean {
    const label = question.label.toLowerCase();
    const category = question.category.toLowerCase();
    return category.includes("case") ||
        category.includes("scenario") ||
        label.includes("scenario") ||
        label.includes("role-specific");
}

export function getQuestionSectionGroups({
    star,
    perma,
    technical,
}: {
    star: QuestionInput[];
    perma: QuestionInput[];
    technical: QuestionInput[];
}) {
    const screening = star.filter(isScreeningQuestion);
    const caseScenario = star.filter((question) => !isScreeningQuestion(question) && isCaseScenarioQuestion(question));
    const behavioral = star.filter((question) => !isScreeningQuestion(question) && !isCaseScenarioQuestion(question));

    return {
        screening,
        behavioral,
        cultureFit: perma,
        caseScenario,
        technicalRoleSpecific: technical,
    };
}
