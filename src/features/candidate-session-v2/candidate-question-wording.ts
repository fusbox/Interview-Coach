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
    planQuestionId?: string;
    coverageKind?: "baseline" | "supplemental";
};

export type CandidateQuestionWordingGeneration = {
    status: "candidate_question_wording_generation_v1";
    provider: string;
    modelName: string;
    promptVersion: string;
    profileId: string;
    configurationFingerprint: string;
    requestFingerprint: string;
    generatedAt: string;
    validation: {
        providerRequestVersion: string;
        providerOutputVersion: string;
        timeoutMs: number;
        transportAttemptCount: 1;
        latencyMs: number;
        tokenUsage: {
            inputTokens: number | null;
            outputTokens: number | null;
        };
        rawOutputStored: false;
        promptStored: false;
    };
};

export type CandidateQuestionWordingResult = {
    status: "questions_worded";
    questions: CandidateQuestionWordingQuestion[];
    generation?: CandidateQuestionWordingGeneration;
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
    const seenQuestionTexts = new Set<string>();
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

        const normalizedQuestionText = normalizeQuestionText(question.questionText);
        if (seenQuestionTexts.has(normalizedQuestionText)) {
            throw new Error("Question wording result must contain distinct questions.");
        }

        seenSlotIds.add(question.slotId);
        seenQuestionTexts.add(normalizedQuestionText);

        return {
            slotId: question.slotId,
            index: plannedSlot.index,
            category: plannedSlot.category,
            questionText: question.questionText,
            ...(plannedSlot.planQuestionId ? { planQuestionId: plannedSlot.planQuestionId } : {}),
            ...(plannedSlot.coverageKind ? { coverageKind: plannedSlot.coverageKind } : {}),
        };
    });

    const generation = parseGeneration(value.generation);
    return {
        status: "questions_worded",
        questions,
        ...(generation ? { generation } : {}),
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
    const categoryOccurrences = createCategoryOccurrenceTracker();
    return parseCandidateQuestionWordingResult({
        status: "questions_worded",
        questions: questionPlanSnapshot.slots.map((slot) => {
            const questionText = createFixtureCandidateQuestionText(
                slot.category,
                categoryOccurrences.next(slot.category),
                setupSnapshot.targetRole,
            );
            return {
                slotId: slot.id,
                category: slot.category,
                questionText,
            };
        }),
    }, questionPlanSnapshot);
}

export function createFixtureCandidateQuestionText(
    category: CandidateQuestionPlanCategory,
    categoryOccurrence: number,
    targetRole: string,
) {
    switch (category) {
        case "screening":
            return [
                `What interests you about this ${targetRole} role?`,
                `What background, availability, or support needs should you be ready to discuss for this ${targetRole} role?`,
                `What would you want an interviewer to understand about your fit for this ${targetRole} role?`,
            ][categoryOccurrence] ?? `What additional detail would help explain your fit for this ${targetRole} role?`;
        case "behavioral":
            return [
                `Tell me about a time you handled work similar to this ${targetRole} role.`,
                `Tell me about a time you solved a problem while doing work relevant to this ${targetRole} role.`,
                `Tell me about a time you improved how work was completed in a role like this ${targetRole} role.`,
            ][categoryOccurrence] ?? `Tell me about another experience that prepares you for this ${targetRole} role.`;
        case "culture_fit":
            return [
                `What kind of work environment helps you do your best work in a ${targetRole} role?`,
                `What communication and support help you do your best work in a ${targetRole} role?`,
                `What keeps you motivated while doing work like this ${targetRole} role?`,
            ][categoryOccurrence] ?? `What work value matters most to you in a ${targetRole} role?`;
        case "case_scenario":
            return [
                `How would you approach a realistic challenge in this ${targetRole} role?`,
                `How would you prioritize competing needs in this ${targetRole} role?`,
                `How would you respond if a routine process stopped working in this ${targetRole} role?`,
            ][categoryOccurrence] ?? `How would you reason through another challenge in this ${targetRole} role?`;
        case "technical_role_specific":
            return [
                `What tools, processes, or role-specific knowledge would help you succeed as a ${targetRole}?`,
                `Which role-specific process would you verify first when starting work as a ${targetRole}?`,
                `How would you check the quality of your work as a ${targetRole}?`,
            ][categoryOccurrence] ?? `What other role-specific knowledge would help you succeed as a ${targetRole}?`;
    }
}

function createCategoryOccurrenceTracker() {
    const occurrences = new Map<CandidateQuestionPlanCategory, number>();
    return {
        next(category: CandidateQuestionPlanCategory) {
            const occurrence = occurrences.get(category) ?? 0;
            occurrences.set(category, occurrence + 1);
            return occurrence;
        },
    };
}

function parseRawQuestion(value: unknown): ParsedRawQuestionWordingQuestion {
    if (!isObject(value)) {
        throw new Error("Question wording result must map exactly to the question plan.");
    }

    const slotId = typeof value.slotId === "string" ? value.slotId.trim() : "";
    const category = typeof value.category === "string" ? value.category.trim() : "";
    const questionText = typeof value.questionText === "string" ? value.questionText.trim() : "";

    if (!slotId || !category || questionText.length < 8 || questionText.length > 500) {
        throw new Error("Question wording result must map exactly to the question plan.");
    }

    return {
        slotId,
        category,
        questionText,
    };
}

function parseGeneration(value: unknown): CandidateQuestionWordingGeneration | null {
    if (value == null) {
        return null;
    }
    if (!isObject(value) || value.status !== "candidate_question_wording_generation_v1") {
        throw new Error("Invalid question wording generation metadata.");
    }
    const validation = isObject(value.validation) ? value.validation : null;
    const tokenUsage = validation && isObject(validation.tokenUsage) ? validation.tokenUsage : null;
    if (
        !readText(value.provider)
        || !readText(value.modelName)
        || !readText(value.promptVersion)
        || !readText(value.profileId)
        || !readSha256(value.configurationFingerprint)
        || !readSha256(value.requestFingerprint)
        || !readIsoDate(value.generatedAt)
        || !validation
        || !readText(validation.providerRequestVersion)
        || !readText(validation.providerOutputVersion)
        || !Number.isInteger(validation.timeoutMs)
        || Number(validation.timeoutMs) <= 0
        || validation.transportAttemptCount !== 1
        || !Number.isFinite(validation.latencyMs)
        || Number(validation.latencyMs) < 0
        || !tokenUsage
        || !isNullableTokenCount(tokenUsage.inputTokens)
        || !isNullableTokenCount(tokenUsage.outputTokens)
        || validation.rawOutputStored !== false
        || validation.promptStored !== false
    ) {
        throw new Error("Invalid question wording generation metadata.");
    }

    return value as CandidateQuestionWordingGeneration;
}

function normalizeQuestionText(value: string) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function readText(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readSha256(value: unknown) {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function readIsoDate(value: unknown) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function isNullableTokenCount(value: unknown) {
    return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
