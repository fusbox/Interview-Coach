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
    planQuestionId?: string;
    coverageKind?: "baseline" | "supplemental";
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
    definition: string;
    answerShape: string[];
    watchFor: string[];
}> = {
    screening: {
        label: "Screening",
        purpose: "Basic fit, interest, background, availability, and role alignment.",
        definition: "Screening questions establish the practical and motivational fit for moving forward.",
        answerShape: [
            "Answer the question directly and keep the main point easy to follow.",
            "Connect your background or interest to this role.",
            "Add one specific detail when it makes the answer more credible.",
        ],
        watchFor: [
            "Generic interest that could apply to any job.",
            "Long background detail before answering the question.",
        ],
    },
    behavioral: {
        label: "Behavioral",
        purpose: "Real past examples that show what you personally did and what changed.",
        definition: "Behavioral questions use past experience to understand how you have handled similar work.",
        answerShape: [
            "Set the situation briefly.",
            "Describe the action you personally took.",
            "Close with the result or what you learned.",
        ],
        watchFor: [
            "A hypothetical answer instead of a real example.",
            "Only describing what the team did without clarifying your part.",
        ],
    },
    culture_fit: {
        label: "Culture / Fit",
        purpose: "Motivation, work style, values alignment, and self-awareness.",
        definition: "Culture and fit questions explore the conditions, values, and motivations that help you do good work.",
        answerShape: [
            "Name the work condition, value, or motivation that matters.",
            "Explain how it shows up in the way you work.",
            "Connect it to the role or organization without overclaiming.",
        ],
        watchFor: [
            "Saying only what you think the interviewer wants to hear.",
            "Broad fit claims without a concrete work example or reason.",
        ],
    },
    case_scenario: {
        label: "Scenario",
        purpose: "How you would reason through a realistic work situation or tradeoff.",
        definition: "Scenario questions reveal how you set priorities, make decisions, and respond to realistic constraints.",
        answerShape: [
            "Clarify the goal and the most important constraint.",
            "Walk through the actions you would take in order.",
            "Explain the reasoning, tradeoff, or check that guides your choice.",
        ],
        watchFor: [
            "Jumping to an answer without showing how you reached it.",
            "Ignoring safety, people, policy, or role-specific constraints.",
        ],
    },
    technical_role_specific: {
        label: "Technical / Role-Specific",
        purpose: "Role knowledge, tools, processes, practical application, and job-specific judgment.",
        definition: "Role-specific questions ask candidates to demonstrate how they use or verify the knowledge and judgment needed for this kind of work.",
        answerShape: [
            "Name the relevant knowledge, tool, process, or judgment.",
            "Explain how you have used it or would apply it in practice.",
            "Be clear about limits, approved procedures, and how you would verify what you do not know.",
        ],
        watchFor: [
            "Vague familiarity without a practical example.",
            "Claiming expertise without explaining application, reasoning, or verification.",
        ],
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

export function createCandidateQuestionPlanFromSlots({
    interviewStage,
    slots,
}: {
    interviewStage: CandidateSetupStageId;
    slots: CandidateQuestionPlanSlot[];
}): CandidateQuestionPlan {
    const categoryCounts = createEmptyCategoryCounts();
    const normalizedSlots = slots.map((slot, index) => {
        categoryCounts[slot.category] += 1;
        return { ...slot, index };
    });

    return {
        interviewStage,
        questionCount: normalizedSlots.length,
        categoryCounts,
        slots: normalizedSlots,
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
