import {
    candidateQuestionPlanCategoryDetails,
    createCandidateQuestionPlanFromSlots,
    type CandidateQuestionPlan,
    type CandidateQuestionPlanCategory,
    type CandidateQuestionPlanSlot,
} from "@/features/candidate-session-v2/candidate-question-plan";
import { parseCandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";
import { candidateSetupStageOptions, type CandidateSetupStageId } from "@/features/candidate-setup-v2/candidate-setup-contract";

export type RecruiterInvitedTranscriptFact = {
    sessionId: string;
    recipientId: string;
    batchLifecycleState: "ready" | "revoked";
    recipientLifecycleState: "ready" | "revoked";
    firstName: string;
    lastName: string;
    email: string;
    requisitionReference: string | null;
    targetRole: string;
    interviewStage: CandidateSetupStageId;
    sessionStatus: "planned" | "in_progress" | "completed" | "abandoned";
    sessionAttemptNumber: number;
    questionPlanSnapshot: unknown;
    questionWordingQuestions: unknown;
    latestAnswers: unknown;
};

export type RecruiterInvitedTranscriptItem = {
    slotId: string;
    number: number;
    categoryLabel: string;
    questionText: string;
    answerText: string | null;
};

export type RecruiterInvitedTranscriptReadModel = {
    sessionId: string;
    candidateName: string;
    candidateEmail: string;
    requisitionReference: string | null;
    targetRole: string;
    interviewStageLabel: string;
    practiceStateLabel: string;
    sessionAttemptNumber: number;
    questionCount: number;
    answeredQuestionCount: number;
    items: RecruiterInvitedTranscriptItem[];
};

export function createRecruiterInvitedTranscriptReadModel(
    fact: RecruiterInvitedTranscriptFact,
): RecruiterInvitedTranscriptReadModel {
    const questionPlan = parseQuestionPlanSnapshot(fact.questionPlanSnapshot, fact.interviewStage);
    const wording = parseCandidateQuestionWordingResult({
        status: "questions_worded",
        questions: fact.questionWordingQuestions,
    }, questionPlan);
    const answers = parseLatestAnswers(fact.latestAnswers, wording.questions);
    const isRevoked = fact.batchLifecycleState === "revoked" || fact.recipientLifecycleState === "revoked";

    return {
        sessionId: fact.sessionId,
        candidateName: `${fact.firstName} ${fact.lastName}`.trim(),
        candidateEmail: fact.email,
        requisitionReference: fact.requisitionReference,
        targetRole: fact.targetRole,
        interviewStageLabel: candidateSetupStageOptions.find((stage) => stage.id === fact.interviewStage)?.label
            ?? "Interview practice",
        practiceStateLabel: isRevoked ? "Revoked" : sessionStatusLabel(fact.sessionStatus),
        sessionAttemptNumber: fact.sessionAttemptNumber,
        questionCount: wording.questions.length,
        answeredQuestionCount: answers.size,
        items: wording.questions.map((question) => ({
            slotId: question.slotId,
            number: question.index + 1,
            categoryLabel: candidateQuestionPlanCategoryDetails[question.category].label,
            questionText: question.questionText,
            answerText: answers.get(question.slotId) ?? null,
        })),
    };
}

function parseQuestionPlanSnapshot(value: unknown, expectedStage: CandidateSetupStageId): CandidateQuestionPlan {
    if (!isObject(value) || value.interviewStage !== expectedStage || !Array.isArray(value.slots)) {
        throw new Error("Recruiter transcript query returned an invalid question plan snapshot.");
    }
    if (!Number.isInteger(value.questionCount) || value.questionCount !== value.slots.length || value.slots.length === 0) {
        throw new Error("Recruiter transcript query returned an invalid question plan snapshot.");
    }

    const seenSlotIds = new Set<string>();
    const slots: CandidateQuestionPlanSlot[] = value.slots.map((rawSlot, index) => {
        if (!isObject(rawSlot)) {
            throw new Error("Recruiter transcript query returned an invalid question plan snapshot.");
        }
        const id = typeof rawSlot.id === "string" ? rawSlot.id.trim() : "";
        const category = readCategory(rawSlot.category);
        if (!id || rawSlot.index !== index || seenSlotIds.has(id)) {
            throw new Error("Recruiter transcript query returned an invalid question plan snapshot.");
        }
        seenSlotIds.add(id);
        const detail = candidateQuestionPlanCategoryDetails[category];
        const coverageKind: CandidateQuestionPlanSlot["coverageKind"] = rawSlot.coverageKind === "baseline"
            || rawSlot.coverageKind === "supplemental"
            ? rawSlot.coverageKind
            : undefined;
        return {
            id,
            index,
            category,
            label: detail.label,
            purpose: detail.purpose,
            ...(typeof rawSlot.planQuestionId === "string" && rawSlot.planQuestionId.trim()
                ? { planQuestionId: rawSlot.planQuestionId.trim() }
                : {}),
            ...(coverageKind ? { coverageKind } : {}),
        };
    });

    return createCandidateQuestionPlanFromSlots({ interviewStage: expectedStage, slots });
}

function parseLatestAnswers(
    value: unknown,
    questions: Array<{ slotId: string; index: number }>,
) {
    if (!Array.isArray(value)) {
        throw new Error("Recruiter transcript query returned invalid answer rows.");
    }
    const questionBySlot = new Map(questions.map((question) => [question.slotId, question]));
    const answers = new Map<string, string>();

    value.forEach((rawAnswer) => {
        if (!isObject(rawAnswer)) {
            throw new Error("Recruiter transcript query returned invalid answer rows.");
        }
        const slotId = typeof rawAnswer.questionSlotId === "string" ? rawAnswer.questionSlotId.trim() : "";
        const answerText = typeof rawAnswer.answerText === "string" ? rawAnswer.answerText : "";
        const question = questionBySlot.get(slotId);
        if (
            !question
            || rawAnswer.questionIndex !== question.index
            || answerText.trim().length === 0
            || answers.has(slotId)
        ) {
            throw new Error("Recruiter transcript query returned answer rows outside the immutable question set.");
        }
        answers.set(slotId, answerText);
    });

    return answers;
}

function readCategory(value: unknown): CandidateQuestionPlanCategory {
    if (
        value === "screening"
        || value === "behavioral"
        || value === "culture_fit"
        || value === "case_scenario"
        || value === "technical_role_specific"
    ) return value;
    throw new Error("Recruiter transcript query returned an invalid question category.");
}

function sessionStatusLabel(status: RecruiterInvitedTranscriptFact["sessionStatus"]) {
    return {
        planned: "Not started",
        in_progress: "In practice",
        completed: "Complete",
        abandoned: "Closed",
    }[status];
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
