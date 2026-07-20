import type { CandidateSetupStageId } from "@/features/candidate-setup-v2/candidate-setup-contract";
import { candidateSetupStageOptions } from "@/features/candidate-setup-v2/candidate-setup-contract";
import type { InvitedPracticeTokenVault } from "./invited-practice-token-vault";
import { createRecruiterInvitationCopyMessage } from "./recruiter-invitation-message";

const QUEUED_RECOVERY_MS = 5 * 60 * 1000;
const SENDING_UNKNOWN_MS = 10 * 60 * 1000;

export type RecruiterInvitationHandoffDeliveryFact = {
    attemptId: string;
    attemptNumber: number;
    lifecycleState: "queued" | "sending" | "provider_accepted" | "failed" | "outcome_unknown";
    retryable: boolean;
    failureCode: string | null;
    queuedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    updatedAt: string;
};

export type RecruiterInvitationHandoffRecipientFact = {
    recipientId: string;
    recipientLifecycleState: "ready" | "revoked";
    candidateIndex: number;
    firstName: string;
    lastName: string;
    email: string;
    requisitionReference: string | null;
    sessionId: string;
    sessionStatus: "planned" | "in_progress" | "completed" | "abandoned";
    sessionAttemptNumber: number;
    tokenCiphertext: string | null;
    encryptionKeyId: string | null;
    tokenExpiresAt: string | null;
    tokenRevokedAt: string | null;
    delivery: RecruiterInvitationHandoffDeliveryFact | null;
};

export type RecruiterInvitationHandoffFact = {
    batchId: string;
    batchLifecycleState: "ready" | "revoked";
    targetRole: string;
    interviewStage: CandidateSetupStageId;
    recipientCount: number;
    batchCreatedAt: string;
    batchUpdatedAt: string;
    recipients: RecruiterInvitationHandoffRecipientFact[];
};

export type RecruiterInvitationHandoffDeliveryState =
    | "not_requested"
    | "queued"
    | "sending"
    | "provider_accepted"
    | "failed_retryable"
    | "failed_terminal"
    | "outcome_unknown";

export type RecruiterInvitationHandoffRecipient = {
    recipientId: string;
    candidateName: string;
    email: string;
    requisitionReference: string | null;
    sessionId: string;
    sessionStateLabel: string;
    sessionAttemptNumber: number;
    deliveryState: RecruiterInvitationHandoffDeliveryState;
    deliveryLabel: string;
    deliveryDetail: string;
    deliveryAttemptNumber: number | null;
    actionEligibility: "send" | "retry" | null;
    linkAvailability: "active" | "expired" | "revoked" | "unavailable";
    inviteLink: string | null;
    copyMessage: string | null;
    tokenExpiresAt: string | null;
};

export type RecruiterInvitationHandoffReadModel = {
    batchId: string;
    targetRole: string;
    interviewStageLabel: string;
    createdAt: string;
    recipientCount: number;
    lifecycleState: "ready" | "revoked";
    revision: string;
    sendEligibleCount: number;
    retryEligibleCount: number;
    recipients: RecruiterInvitationHandoffRecipient[];
};

export function createRecruiterInvitationHandoffReadModel(
    fact: RecruiterInvitationHandoffFact,
    dependencies: {
        appOrigin: string;
        recruiterName: string;
        tokenVault: InvitedPracticeTokenVault;
        now?: Date;
    },
): RecruiterInvitationHandoffReadModel {
    if (fact.recipients.length !== fact.recipientCount) {
        throw new Error("Recruiter invitation handoff fact has an incomplete recipient set.");
    }
    const now = dependencies.now ?? new Date();
    const recipients = fact.recipients
        .slice()
        .sort((left, right) => left.candidateIndex - right.candidateIndex)
        .map((recipient) => toRecipient(fact, recipient, dependencies, now));

    const revision = [
        fact.batchUpdatedAt,
        fact.batchLifecycleState,
        ...fact.recipients.flatMap((recipient) => [
            recipient.recipientId,
            recipient.recipientLifecycleState,
            recipient.delivery?.updatedAt ?? "no-delivery",
            recipient.tokenExpiresAt ?? "no-expiry",
            recipient.tokenRevokedAt ?? "not-revoked",
        ]),
    ].join(":");

    return {
        batchId: fact.batchId,
        targetRole: fact.targetRole,
        interviewStageLabel: candidateSetupStageOptions.find((stage) => stage.id === fact.interviewStage)?.label
            ?? "Interview practice",
        createdAt: fact.batchCreatedAt,
        recipientCount: fact.recipientCount,
        lifecycleState: fact.batchLifecycleState,
        revision,
        sendEligibleCount: recipients.filter((recipient) => recipient.actionEligibility === "send").length,
        retryEligibleCount: recipients.filter((recipient) => recipient.actionEligibility === "retry").length,
        recipients,
    };
}

function toRecipient(
    batch: RecruiterInvitationHandoffFact,
    recipient: RecruiterInvitationHandoffRecipientFact,
    dependencies: {
        appOrigin: string;
        recruiterName: string;
        tokenVault: InvitedPracticeTokenVault;
    },
    now: Date,
): RecruiterInvitationHandoffRecipient {
    const link = recoverLink(batch, recipient, dependencies, now);
    const delivery = resolveDelivery(recipient.delivery, now);
    const ownerActive = batch.batchLifecycleState === "ready" && recipient.recipientLifecycleState === "ready";
    const actionEligibility = ownerActive && link.availability === "active"
        ? delivery.actionEligibility
        : null;

    return {
        recipientId: recipient.recipientId,
        candidateName: `${recipient.firstName} ${recipient.lastName}`.trim(),
        email: recipient.email,
        requisitionReference: recipient.requisitionReference,
        sessionId: recipient.sessionId,
        sessionStateLabel: ownerActive ? sessionStateLabel(recipient.sessionStatus) : "Revoked",
        sessionAttemptNumber: recipient.sessionAttemptNumber,
        deliveryState: delivery.state,
        deliveryLabel: delivery.label,
        deliveryDetail: delivery.detail,
        deliveryAttemptNumber: recipient.delivery?.attemptNumber ?? null,
        actionEligibility,
        linkAvailability: link.availability,
        inviteLink: link.inviteLink,
        copyMessage: link.inviteLink ? createRecruiterInvitationCopyMessage({
            firstName: recipient.firstName,
            targetRole: batch.targetRole,
            inviteLink: link.inviteLink,
            recruiterName: dependencies.recruiterName,
        }) : null,
        tokenExpiresAt: recipient.tokenExpiresAt,
    };
}

function recoverLink(
    batch: RecruiterInvitationHandoffFact,
    recipient: RecruiterInvitationHandoffRecipientFact,
    dependencies: { appOrigin: string; tokenVault: InvitedPracticeTokenVault },
    now: Date,
): {
    availability: RecruiterInvitationHandoffRecipient["linkAvailability"];
    inviteLink: string | null;
} {
    if (batch.batchLifecycleState === "revoked" || recipient.recipientLifecycleState === "revoked" || recipient.tokenRevokedAt) {
        return { availability: "revoked", inviteLink: null };
    }
    if (!recipient.tokenExpiresAt || Date.parse(recipient.tokenExpiresAt) <= now.valueOf()) {
        return { availability: "expired", inviteLink: null };
    }
    if (!recipient.tokenCiphertext || !recipient.encryptionKeyId) {
        return { availability: "unavailable", inviteLink: null };
    }
    try {
        const rawToken = dependencies.tokenVault.decryptToken({
            tokenCiphertext: recipient.tokenCiphertext,
            encryptionKeyId: recipient.encryptionKeyId,
        });
        return {
            availability: "active",
            inviteLink: `${dependencies.appOrigin}/s/${encodeURIComponent(rawToken)}`,
        };
    } catch {
        return { availability: "unavailable", inviteLink: null };
    }
}

function resolveDelivery(delivery: RecruiterInvitationHandoffDeliveryFact | null, now: Date): {
    state: RecruiterInvitationHandoffDeliveryState;
    label: string;
    detail: string;
    actionEligibility: "send" | "retry" | null;
} {
    if (!delivery) {
        return {
            state: "not_requested",
            label: "Not emailed",
            detail: "Ready to send through Interview Coach or copy into your usual candidate message.",
            actionEligibility: "send",
        };
    }
    if (delivery.lifecycleState === "provider_accepted") {
        return {
            state: "provider_accepted",
            label: "Accepted by email provider",
            detail: "The provider accepted this message. Mailbox delivery is not confirmed.",
            actionEligibility: null,
        };
    }
    if (delivery.lifecycleState === "queued") {
        const stale = now.valueOf() - Date.parse(delivery.queuedAt) >= QUEUED_RECOVERY_MS;
        return stale ? {
            state: "failed_retryable",
            label: "Queued delivery can be retried",
            detail: "The prior claim ended before provider work began.",
            actionEligibility: "retry",
        } : {
            state: "queued",
            label: "Email queued",
            detail: "Delivery has been claimed and cannot be started again yet.",
            actionEligibility: null,
        };
    }
    if (delivery.lifecycleState === "sending") {
        const startedAt = delivery.startedAt ? Date.parse(delivery.startedAt) : Date.parse(delivery.updatedAt);
        const stale = now.valueOf() - startedAt >= SENDING_UNKNOWN_MS;
        return stale ? {
            state: "outcome_unknown",
            label: "Delivery outcome needs review",
            detail: "The provider may have accepted this message. Automatic retry is disabled.",
            actionEligibility: null,
        } : {
            state: "sending",
            label: "Sending",
            detail: "A provider request may be in progress. Automatic retry is disabled.",
            actionEligibility: null,
        };
    }
    if (delivery.lifecycleState === "outcome_unknown") {
        return {
            state: "outcome_unknown",
            label: "Delivery outcome needs review",
            detail: "The provider may have accepted this message. Automatic retry is disabled.",
            actionEligibility: null,
        };
    }
    if (delivery.retryable) {
        return {
            state: "failed_retryable",
            label: "Email failed - retry available",
            detail: "No provider acceptance was recorded, so this recipient can be retried safely.",
            actionEligibility: "retry",
        };
    }
    return {
        state: "failed_terminal",
        label: "Email could not be retried",
        detail: "Automatic retry is disabled for this delivery outcome.",
        actionEligibility: null,
    };
}

function sessionStateLabel(status: RecruiterInvitationHandoffRecipientFact["sessionStatus"]) {
    return {
        planned: "Not started",
        in_progress: "In practice",
        completed: "Complete",
        abandoned: "Closed",
    }[status];
}
