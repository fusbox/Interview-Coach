import type {
    CandidateSetupPayload,
} from "@/features/candidate-setup-v2/candidate-setup-contract";
import type {
    CandidateQuestionPlan,
    CandidateQuestionPlanCategory,
} from "./candidate-question-plan";

export type CandidateQuestionWordingSetupSnapshot = CandidateSetupPayload & {
    createdAt: string;
};

export type CandidateQuestionWordingRequest = {
    status: "question_wording_requested";
    requestedAt: string;
    setupSnapshot: CandidateQuestionWordingSetupSnapshot;
    questionPlanSnapshot: CandidateQuestionPlan;
};

export type CandidateQuestionWordingQuestion = {
    slotId: string;
    index: number;
    category: CandidateQuestionPlanCategory;
    questionText: string;
};

export type CandidateQuestionWordingResult = {
    status: "questions_worded";
    questions: CandidateQuestionWordingQuestion[];
};

export type CandidateQuestionWordingUnavailableResult = {
    status: "question_wording_unavailable";
    reason: "provider_not_configured";
};

type ParsedRawQuestionWordingQuestion = {
    slotId: string;
    category: string;
    questionText: string;
};

export function createCandidateQuestionWordingRequest({
    setupSnapshot,
    questionPlanSnapshot,
    now,
}: {
    setupSnapshot: CandidateQuestionWordingSetupSnapshot;
    questionPlanSnapshot: CandidateQuestionPlan;
    now: Date;
}): CandidateQuestionWordingRequest {
    if (
        setupSnapshot.interviewStage !== questionPlanSnapshot.interviewStage ||
        setupSnapshot.questionCount !== questionPlanSnapshot.questionCount
    ) {
        throw new Error("Question plan snapshot does not match setup snapshot.");
    }

    return {
        status: "question_wording_requested",
        requestedAt: now.toISOString(),
        setupSnapshot,
        questionPlanSnapshot,
    };
}

export function parseCandidateQuestionWordingResult(
    value: unknown,
    questionPlanSnapshot: CandidateQuestionPlan,
): CandidateQuestionWordingResult {
    if (!isObject(value) || value.status !== "questions_worded" || !Array.isArray(value.questions)) {
        throw new Error("Invalid question wording result.");
    }

    if (value.questions.length !== questionPlanSnapshot.slots.length) {
        throw new Error("Question wording result must map exactly to the question plan.");
    }

    const seenSlotIds = new Set<string>();
    const questions = value.questions.map((rawQuestion, index) => {
        const question = parseRawQuestion(rawQuestion);
        const plannedSlot = questionPlanSnapshot.slots[index];

        if (
            !plannedSlot ||
            question.slotId !== plannedSlot.id ||
            question.category !== plannedSlot.category ||
            seenSlotIds.has(question.slotId)
        ) {
            throw new Error("Question wording result must map exactly to the question plan.");
        }

        seenSlotIds.add(question.slotId);

        return {
            slotId: question.slotId,
            index: plannedSlot.index,
            category: plannedSlot.category,
            questionText: question.questionText,
        };
    });

    return {
        status: "questions_worded",
        questions,
    };
}

export function createCandidateQuestionWordingUnavailableResult(): CandidateQuestionWordingUnavailableResult {
    return {
        status: "question_wording_unavailable",
        reason: "provider_not_configured",
    };
}

export function createFixtureCandidateQuestionWordingResult({
    setupSnapshot,
    questionPlanSnapshot,
}: {
    setupSnapshot: CandidateQuestionWordingSetupSnapshot;
    questionPlanSnapshot: CandidateQuestionPlan;
}): CandidateQuestionWordingResult {
    return parseCandidateQuestionWordingResult({
        status: "questions_worded",
        questions: questionPlanSnapshot.slots.map((slot) => ({
            slotId: slot.id,
            category: slot.category,
            questionText: createFixtureQuestionText(slot, setupSnapshot),
        })),
    }, questionPlanSnapshot);
}

function createFixtureQuestionText(
    slot: CandidateQuestionPlan["slots"][number],
    setupSnapshot: CandidateQuestionWordingSetupSnapshot,
) {
    switch (slot.category) {
        case "screening":
            if (slot.index > 0) {
                return `What background, availability, or support needs should you be ready to discuss for this ${setupSnapshot.targetRole} role?`;
            }
            return `What interests you about this ${setupSnapshot.targetRole} role?`;
        case "behavioral":
            return `Tell me about a time you handled work similar to this ${setupSnapshot.targetRole} role.`;
        case "culture_fit":
            return `What kind of work environment helps you do your best work in a ${setupSnapshot.targetRole} role?`;
        case "case_scenario":
            return `How would you approach a realistic challenge in this ${setupSnapshot.targetRole} role?`;
        case "technical_role_specific":
            return `What tools, processes, or role-specific knowledge would help you succeed as a ${setupSnapshot.targetRole}?`;
    }
}

function parseRawQuestion(value: unknown): ParsedRawQuestionWordingQuestion {
    if (!isObject(value)) {
        throw new Error("Question wording result must map exactly to the question plan.");
    }

    const slotId = typeof value.slotId === "string" ? value.slotId.trim() : "";
    const category = typeof value.category === "string" ? value.category.trim() : "";
    const questionText = typeof value.questionText === "string" ? value.questionText.trim() : "";

    if (!slotId || !category || !questionText) {
        throw new Error("Question wording result must map exactly to the question plan.");
    }

    return {
        slotId,
        category,
        questionText,
    };
}

function isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
