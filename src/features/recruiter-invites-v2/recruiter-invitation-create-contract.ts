import { createHash } from "node:crypto";

import {
    CANDIDATE_SETUP_LIMITS,
    candidateSetupStageOptions,
    type CandidateSetupStageId,
} from "@/features/candidate-setup-v2/candidate-setup-contract";
import { getCandidateStageBaselineQuestionCount } from "@/features/candidate-setup-v2/candidate-practice-plan-baseline";
import {
    createCandidateQuestionPlan,
    type CandidateQuestionPlan,
} from "@/features/candidate-session-v2/candidate-question-plan";
import {
    parseCandidateQuestionWordingResult,
    type CandidateQuestionWordingResult,
} from "@/features/candidate-session-v2/candidate-question-wording";

const ACTION_KEY_MIN = 16;
const ACTION_KEY_MAX = 200;
const QUESTION_TEXT_MIN = 8;
const QUESTION_TEXT_MAX = 500;
const NAME_MAX = 120;
const EMAIL_MAX = 320;
const REQUISITION_MAX = 160;
const MAX_RECIPIENTS = 100;

export type RecruiterQuestionSource = "generated" | "manual";

export type RecruiterPrepareQuestionsRequest = {
    operation: "prepare_questions";
    actionKey: string;
    source: RecruiterQuestionSource;
    targetRole: string;
    jobDescription: string;
    interviewStage: CandidateSetupStageId;
    questions: string[] | null;
};

export type RecruiterCreateInvitationsRequest = {
    operation: "create_invitations";
    actionKey: string;
    questionSetId: string;
    recipients: Array<{
        firstName: string;
        lastName: string;
        email: string;
        requisitionReference?: string;
        resumeText?: string;
    }>;
};

export type RecruiterInvitationCreateRequest =
    | RecruiterPrepareQuestionsRequest
    | RecruiterCreateInvitationsRequest;

export type PreparedRecruiterQuestionSetRequest = RecruiterPrepareQuestionsRequest & {
    actionKeyHash: string;
    requestFingerprint: string;
    questionPlanSnapshot: CandidateQuestionPlan;
    manualQuestionWordingSnapshot: CandidateQuestionWordingResult | null;
};

export class RecruiterInvitationCreateValidationError extends Error {
    constructor(message = "Invitation create request is invalid.") {
        super(message);
        this.name = "RecruiterInvitationCreateValidationError";
    }
}

export function parseRecruiterInvitationCreateRequest(value: unknown): RecruiterInvitationCreateRequest {
    const body = readObject(value);
    if (body.operation === "prepare_questions") {
        assertOnlyKeys(body, [
            "operation",
            "actionKey",
            "source",
            "targetRole",
            "jobDescription",
            "interviewStage",
            "questions",
        ]);
        const actionKey = normalizeActionKey(body.actionKey);
        const source = readQuestionSource(body.source);
        const targetRole = normalizeRequiredText(body.targetRole, CANDIDATE_SETUP_LIMITS.targetRole);
        const jobDescription = normalizeRequiredText(body.jobDescription, CANDIDATE_SETUP_LIMITS.jobDescription);
        const interviewStage = readInterviewStage(body.interviewStage);
        const questionCount = getCandidateStageBaselineQuestionCount(interviewStage);
        const questions = source === "manual"
            ? normalizeManualQuestions(body.questions, questionCount)
            : null;
        if (source === "generated" && body.questions != null) {
            throw new RecruiterInvitationCreateValidationError();
        }
        return {
            operation: "prepare_questions",
            actionKey,
            source,
            targetRole,
            jobDescription,
            interviewStage,
            questions,
        };
    }

    if (body.operation === "create_invitations") {
        assertOnlyKeys(body, ["operation", "actionKey", "questionSetId", "recipients"]);
        const recipients = readRecipients(body.recipients);
        return {
            operation: "create_invitations",
            actionKey: normalizeActionKey(body.actionKey),
            questionSetId: readUuid(body.questionSetId),
            recipients,
        };
    }

    throw new RecruiterInvitationCreateValidationError();
}

export function prepareRecruiterQuestionSetRequest(
    input: RecruiterPrepareQuestionsRequest,
): PreparedRecruiterQuestionSetRequest {
    const questionPlanSnapshot = createCandidateQuestionPlan({
        interviewStage: input.interviewStage,
        questionCount: getCandidateStageBaselineQuestionCount(input.interviewStage),
    });
    const manualQuestionWordingSnapshot = input.source === "manual"
        ? createManualQuestionWording(questionPlanSnapshot, input.questions ?? [])
        : null;
    const requestFingerprint = hashStableValue({
        source: input.source,
        targetRole: input.targetRole,
        jobDescription: input.jobDescription,
        interviewStage: input.interviewStage,
        questions: input.questions,
    });

    return {
        ...input,
        actionKeyHash: hashText(input.actionKey),
        requestFingerprint,
        questionPlanSnapshot,
        manualQuestionWordingSnapshot,
    };
}

export function hashRecruiterInvitationActionKey(actionKey: string) {
    return hashText(normalizeActionKey(actionKey));
}

export function getRecruiterInvitationStageOptions() {
    return candidateSetupStageOptions.map((stage) => ({
        id: stage.id,
        label: stage.label,
        questionCount: getCandidateStageBaselineQuestionCount(stage.id),
    }));
}

function createManualQuestionWording(
    questionPlanSnapshot: CandidateQuestionPlan,
    questions: string[],
): CandidateQuestionWordingResult {
    return parseCandidateQuestionWordingResult({
        status: "questions_worded",
        questions: questionPlanSnapshot.slots.map((slot, index) => ({
                slotId: slot.id,
                category: slot.category,
                questionText: questions[index],
            })),
    }, questionPlanSnapshot);
}

function readRecipients(value: unknown): RecruiterCreateInvitationsRequest["recipients"] {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_RECIPIENTS) {
        throw new RecruiterInvitationCreateValidationError();
    }
    const recipients = value.map((item) => {
        const recipient = readObject(item);
        const email = normalizeEmail(recipient.email);
        const requisitionReference = normalizeOptionalText(recipient.requisitionReference, REQUISITION_MAX);
        const resumeText = normalizeOptionalText(recipient.resumeText, CANDIDATE_SETUP_LIMITS.resumeText);
        return {
            firstName: normalizeRequiredText(recipient.firstName, NAME_MAX),
            lastName: normalizeRequiredText(recipient.lastName, NAME_MAX),
            email,
            ...(requisitionReference ? { requisitionReference } : {}),
            ...(resumeText ? { resumeText } : {}),
        };
    });
    if (new Set(recipients.map((recipient) => recipient.email)).size !== recipients.length) {
        throw new RecruiterInvitationCreateValidationError("Recipient email must be unique within the batch.");
    }
    return recipients;
}

function normalizeManualQuestions(value: unknown, expectedCount: number) {
    if (!Array.isArray(value) || value.length !== expectedCount) {
        throw new RecruiterInvitationCreateValidationError();
    }
    return value.map((question) => {
        const normalized = normalizeRequiredText(question, QUESTION_TEXT_MAX);
        if (normalized.length < QUESTION_TEXT_MIN) {
            throw new RecruiterInvitationCreateValidationError();
        }
        return normalized;
    });
}

function normalizeActionKey(value: unknown) {
    const key = typeof value === "string" ? value.trim() : "";
    if (key.length < ACTION_KEY_MIN || key.length > ACTION_KEY_MAX) {
        throw new RecruiterInvitationCreateValidationError();
    }
    return key;
}

function readQuestionSource(value: unknown): RecruiterQuestionSource {
    if (value === "generated" || value === "manual") return value;
    throw new RecruiterInvitationCreateValidationError();
}

function readInterviewStage(value: unknown): CandidateSetupStageId {
    const stage = candidateSetupStageOptions.find((option) => option.id === value)?.id;
    if (!stage) throw new RecruiterInvitationCreateValidationError();
    return stage;
}

function readUuid(value: unknown) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
        throw new RecruiterInvitationCreateValidationError();
    }
    return normalized;
}

function normalizeRequiredText(value: unknown, maximumLength: number) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized || normalized.length > maximumLength) {
        throw new RecruiterInvitationCreateValidationError();
    }
    return normalized;
}

function normalizeOptionalText(value: unknown, maximumLength: number) {
    if (value == null || value === "") return null;
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized || normalized.length > maximumLength) {
        throw new RecruiterInvitationCreateValidationError();
    }
    return normalized;
}

function normalizeEmail(value: unknown) {
    const email = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (email.length > EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new RecruiterInvitationCreateValidationError();
    }
    return email;
}

function readObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new RecruiterInvitationCreateValidationError();
    }
    return value as Record<string, unknown>;
}

function assertOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]) {
    const allowed = new Set(allowedKeys);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new RecruiterInvitationCreateValidationError();
    }
}

function hashText(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashStableValue(value: unknown) {
    return hashText(stableStringify(value));
}

function stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
            .join(",")}}`;
    }
    return JSON.stringify(value);
}
