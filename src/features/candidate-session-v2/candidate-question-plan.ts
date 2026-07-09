import type { CandidateSetupStageId } from "@/features/candidate-setup-v2/candidate-setup-contract";

export type CandidateQuestionPlanCategory =
    | "screening"
    | "behavioral"
    | "culture_fit"
    | "case_scenario"
    | "technical_role_specific";

export type CandidateQuestionPlanSlot = {
    id: string;
    index: number;
    category: CandidateQuestionPlanCategory;
    label: string;
    purpose: string;
};

export type CandidateQuestionPlan = {
    interviewStage: CandidateSetupStageId;
    questionCount: number;
    categoryCounts: Record<CandidateQuestionPlanCategory, number>;
    slots: CandidateQuestionPlanSlot[];
};

export const candidateQuestionPlanCategoryDetails: Record<CandidateQuestionPlanCategory, {
    label: string;
    purpose: string;
}> = {
    screening: {
        label: "Screening",
        purpose: "Basic fit, interest, background, availability, and role alignment.",
    },
    behavioral: {
        label: "Behavioral",
        purpose: "Real past examples that show what you personally did and what changed.",
    },
    culture_fit: {
        label: "Culture / Fit",
        purpose: "Motivation, work style, values alignment, and self-awareness.",
    },
    case_scenario: {
        label: "Scenario",
        purpose: "How you would reason through a realistic work situation or tradeoff.",
    },
    technical_role_specific: {
        label: "Technical / Role-Specific",
        purpose: "Role knowledge, tools, processes, and job-specific judgment.",
    },
};

const stageSequences: Record<CandidateSetupStageId, CandidateQuestionPlanCategory[]> = {
    practice_only: [
        "screening",
        "behavioral",
        "culture_fit",
        "case_scenario",
        "technical_role_specific",
        "behavioral",
        "culture_fit",
        "case_scenario",
        "technical_role_specific",
        "behavioral",
    ],
    screening: [
        "screening",
        "behavioral",
        "culture_fit",
        "screening",
        "technical_role_specific",
        "case_scenario",
        "behavioral",
        "culture_fit",
        "screening",
        "technical_role_specific",
    ],
    first_interview: [
        "screening",
        "behavioral",
        "culture_fit",
        "case_scenario",
        "technical_role_specific",
        "screening",
        "behavioral",
        "culture_fit",
        "case_scenario",
        "technical_role_specific",
    ],
    follow_up: [
        "behavioral",
        "technical_role_specific",
        "case_scenario",
        "culture_fit",
        "behavioral",
        "technical_role_specific",
        "culture_fit",
        "case_scenario",
        "behavioral",
        "culture_fit",
    ],
    final_interview: [
        "behavioral",
        "behavioral",
        "culture_fit",
        "culture_fit",
        "case_scenario",
        "technical_role_specific",
        "behavioral",
        "culture_fit",
        "case_scenario",
        "technical_role_specific",
    ],
};

export function createCandidateQuestionPlan({
    interviewStage,
    questionCount,
}: {
    interviewStage: CandidateSetupStageId;
    questionCount: number;
}): CandidateQuestionPlan {
    const sequence = stageSequences[interviewStage] ?? stageSequences.first_interview;
    const normalizedQuestionCount = Math.max(0, Math.min(questionCount, sequence.length));
    const categories = sequence.slice(0, normalizedQuestionCount);
    const categoryCounts = createEmptyCategoryCounts();

    const slots = categories.map((category, index) => {
        categoryCounts[category] += 1;
        const detail = candidateQuestionPlanCategoryDetails[category];

        return {
            id: `slot-${index + 1}`,
            index,
            category,
            label: detail.label,
            purpose: detail.purpose,
        };
    });

    return {
        interviewStage,
        questionCount: normalizedQuestionCount,
        categoryCounts,
        slots,
    };
}

function createEmptyCategoryCounts(): Record<CandidateQuestionPlanCategory, number> {
    return {
        screening: 0,
        behavioral: 0,
        culture_fit: 0,
        case_scenario: 0,
        technical_role_specific: 0,
    };
}
