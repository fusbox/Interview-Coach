import { createHash, randomUUID } from "node:crypto";

import type { CandidateSetupStageId } from "@/features/candidate-setup-v2/candidate-setup-contract";
import type { CandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import {
    parseCandidateQuestionWordingResult,
    type CandidateQuestionWordingResult,
} from "@/features/candidate-session-v2/candidate-question-wording";

import type { InvitedPracticeTokenVault } from "./invited-practice-token-vault";

const MIN_IDEMPOTENCY_KEY_LENGTH = 16;
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
const MAX_RECIPIENTS = 100;
const MIN_TOKEN_TTL_SECONDS = 60;
const MAX_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;

export type RecruiterInvitationRecipientInput = {
    firstName: string;
    lastName: string;
    email: string;
    requisitionReference?: string;
    resumeText?: string;
};

export type CreateRecruiterInvitationAggregateInput = {
    recruiterId: string;
    idempotencyKey: string;
    targetRole: string;
    jobDescription?: string;
    interviewStage: CandidateSetupStageId;
    questionPlanSnapshot: CandidateQuestionPlan;
    questionWordingSnapshot: CandidateQuestionWordingResult;
    recipients: RecruiterInvitationRecipientInput[];
    tokenTtlSeconds: number;
};

export type PreparedRecruiterInvitationRecipient = {
    candidateIndex: number;
    recipientId: string;
    sessionId: string;
    firstName: string;
    lastName: string;
    email: string;
    requisitionReference: string | null;
    resumeText: string | null;
    tokenHash: string;
    tokenCiphertext: string;
    encryptionKeyId: string;
    tokenExpiresAt: string;
};

export type PreparedRecruiterInvitationAggregate = {
    recruiterId: string;
    idempotencyKeyHash: string;
    requestFingerprint: string;
    batchId: string;
    targetRole: string;
    jobDescription: string | null;
    interviewStage: CandidateSetupStageId;
    questionPlanSnapshot: CandidateQuestionPlan;
    questionWordingSnapshot: CandidateQuestionWordingResult;
    recipients: PreparedRecruiterInvitationRecipient[];
};

export function prepareRecruiterInvitationAggregate(
    input: CreateRecruiterInvitationAggregateInput,
    dependencies: {
        tokenVault: InvitedPracticeTokenVault;
        now?: Date;
        createId?: () => string;
    },
): PreparedRecruiterInvitationAggregate {
    const now = dependencies.now ?? new Date();
    const createId = dependencies.createId ?? randomUUID;
    const targetRole = normalizeRequiredText(input.targetRole, "target role");
    const jobDescription = normalizeOptionalText(input.jobDescription);
    const idempotencyKey = input.idempotencyKey.trim();

    if (
        idempotencyKey.length < MIN_IDEMPOTENCY_KEY_LENGTH
        || idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH
    ) {
        throw new Error("Invitation idempotency key is invalid.");
    }
    if (!input.recruiterId.trim()) {
        throw new Error("Recruiter identity is required.");
    }
    if (!Number.isInteger(input.tokenTtlSeconds)
        || input.tokenTtlSeconds < MIN_TOKEN_TTL_SECONDS
        || input.tokenTtlSeconds > MAX_TOKEN_TTL_SECONDS) {
        throw new Error("Invitation token lifetime is outside the supported range.");
    }
    if (input.recipients.length < 1 || input.recipients.length > MAX_RECIPIENTS) {
        throw new Error("An invitation batch requires between 1 and 100 recipients.");
    }
    if (
        input.questionPlanSnapshot.interviewStage !== input.interviewStage
        || input.questionPlanSnapshot.questionCount < 1
        || input.questionPlanSnapshot.slots.length !== input.questionPlanSnapshot.questionCount
    ) {
        throw new Error("Invitation question plan does not match the interview stage and count.");
    }

    const questionWordingSnapshot = parseCandidateQuestionWordingResult(
        input.questionWordingSnapshot,
        input.questionPlanSnapshot,
    );
    const normalizedRecipients = input.recipients.map((recipient) => ({
        firstName: normalizeRequiredText(recipient.firstName, "recipient first name"),
        lastName: normalizeRequiredText(recipient.lastName, "recipient last name"),
        email: normalizeEmail(recipient.email),
        requisitionReference: normalizeOptionalText(recipient.requisitionReference),
        resumeText: normalizeOptionalText(recipient.resumeText),
    }));
    if (new Set(normalizedRecipients.map((recipient) => recipient.email)).size !== normalizedRecipients.length) {
        throw new Error("Recipient email must be unique within an invitation batch.");
    }

    const tokenExpiresAt = new Date(now.getTime() + input.tokenTtlSeconds * 1000).toISOString();
    const requestFingerprint = sha256(stableStringify({
        targetRole,
        jobDescription,
        interviewStage: input.interviewStage,
        questionPlanSnapshot: input.questionPlanSnapshot,
        questionWordingSnapshot,
        recipients: normalizedRecipients,
        tokenTtlSeconds: input.tokenTtlSeconds,
    }));

    return {
        recruiterId: input.recruiterId,
        idempotencyKeyHash: sha256(idempotencyKey),
        requestFingerprint,
        batchId: createId(),
        targetRole,
        jobDescription,
        interviewStage: input.interviewStage,
        questionPlanSnapshot: input.questionPlanSnapshot,
        questionWordingSnapshot,
        recipients: normalizedRecipients.map((recipient, candidateIndex) => {
            const token = dependencies.tokenVault.createTokenMaterial();
            return {
                candidateIndex,
                recipientId: createId(),
                sessionId: createId(),
                ...recipient,
                tokenHash: token.tokenHash,
                tokenCiphertext: token.tokenCiphertext,
                encryptionKeyId: token.encryptionKeyId,
                tokenExpiresAt,
            };
        }),
    };
}

function normalizeRequiredText(value: string, label: string) {
    const normalized = value.trim();
    if (!normalized) throw new Error(`Invitation ${label} is required.`);
    return normalized;
}

function normalizeOptionalText(value: string | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
}

function normalizeEmail(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        throw new Error("Invitation recipient email is invalid.");
    }
    return normalized;
}

function sha256(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }
    if (value && typeof value === "object") {
        return `{${Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
            .join(",")}}`;
    }
    return JSON.stringify(value);
}
