import { createHash, randomUUID } from "node:crypto";

import type { InvitedPracticeTokenVault } from "./invited-practice-token-vault";
import type { RecruiterInvitationDeliveryProvider } from "./recruiter-invitation-delivery-provider";
import { RecruiterInvitationProviderError } from "./recruiter-invitation-delivery-provider";
import type {
    RecruiterInvitationDeliveryClaimOutcome,
    RecruiterInvitationDeliveryRepository,
} from "./recruiter-invitation-delivery-repository";
import { createRecruiterInvitationMessage } from "./recruiter-invitation-message";
import type { RecruiterInvitationRepository } from "./recruiter-invitation-repository";

const DELIVERY_CONCURRENCY = 5;

export type RecruiterInvitationDeliveryResult = {
    batchId: string;
    recipients: Array<{
        recipientId: string;
        attemptId: string | null;
        attemptNumber: number | null;
        status: "provider_accepted" | "failed" | "in_progress" | "outcome_unknown" | "not_retryable";
        retryable: boolean;
        failureCode: string | null;
    }>;
};

export class RecruiterInvitationDeliveryNotFoundError extends Error {}
export class RecruiterInvitationDeliveryPersistenceError extends Error {}

export async function deliverRecruiterInvitationBatch(input: {
    recruiterId: string;
    recruiterName: string;
    batchId: string;
    actionKey: string;
    appOrigin: string;
}, dependencies: {
    invitationRepository: RecruiterInvitationRepository;
    deliveryRepository: RecruiterInvitationDeliveryRepository;
    provider: RecruiterInvitationDeliveryProvider;
    tokenVault: InvitedPracticeTokenVault;
    createAttemptId?: () => string;
}): Promise<RecruiterInvitationDeliveryResult> {
    const aggregate = await dependencies.invitationRepository.findOwnedAggregate({
        recruiterId: input.recruiterId,
        batchId: input.batchId,
    });
    if (!aggregate) throw new RecruiterInvitationDeliveryNotFoundError("Invitation batch not found.");

    const actionKeyHash = createHash("sha256").update(input.actionKey, "utf8").digest("hex");
    const createAttemptId = dependencies.createAttemptId ?? randomUUID;
    const recipients = await mapWithConcurrency(aggregate.recipients, DELIVERY_CONCURRENCY, async (recipient) => {
        if (
            aggregate.batchLifecycleState === "revoked"
            || recipient.recipientLifecycleState === "revoked"
            || Date.parse(recipient.tokenExpiresAt) <= Date.now()
        ) {
            return {
                recipientId: recipient.recipientId,
                attemptId: null,
                attemptNumber: null,
                status: "not_retryable" as const,
                retryable: false,
                failureCode: "invitation_inactive",
            };
        }
        const claim = await dependencies.deliveryRepository.claim({
            recruiterId: input.recruiterId,
            batchId: input.batchId,
            recipientId: recipient.recipientId,
            attemptId: createAttemptId(),
            actionKeyHash,
            provider: dependencies.provider.name,
        });
        if (!claim.attempt) throw new RecruiterInvitationDeliveryNotFoundError("Invitation recipient not found.");

        const prior = mapClaimWithoutProviderCall(claim.outcome, claim.attempt);
        if (prior) return { recipientId: recipient.recipientId, ...prior };

        let rawToken: string;
        try {
            rawToken = dependencies.tokenVault.decryptToken({
                tokenCiphertext: recipient.tokenCiphertext,
                encryptionKeyId: recipient.encryptionKeyId,
            });
        } catch {
            const persisted = await dependencies.deliveryRepository.fail({
                recruiterId: input.recruiterId,
                attemptId: claim.attempt.attemptId,
                failureCode: "token_unavailable",
                retryable: true,
                outcomeUnknown: false,
            });
            if (!persisted) throw new RecruiterInvitationDeliveryPersistenceError("Delivery failure could not be saved.");
            return failureResult(recipient.recipientId, claim.attempt, "token_unavailable", true, false);
        }

        const started = await dependencies.deliveryRepository.start({
            recruiterId: input.recruiterId,
            attemptId: claim.attempt.attemptId,
        });
        if (!started) {
            return {
                recipientId: recipient.recipientId,
                attemptId: claim.attempt.attemptId,
                attemptNumber: claim.attempt.attemptNumber,
                status: "in_progress" as const,
                retryable: false,
                failureCode: null,
            };
        }

        const inviteLink = `${input.appOrigin}/s/${encodeURIComponent(rawToken)}`;
        const message = createRecruiterInvitationMessage({
            firstName: recipient.firstName,
            targetRole: aggregate.targetRole,
            inviteLink,
            recruiterName: input.recruiterName,
        });

        try {
            const providerResult = await dependencies.provider.send({
                attemptId: started.attemptId,
                recipientEmail: recipient.email,
                message,
            });
            const persisted = await dependencies.deliveryRepository.accept({
                recruiterId: input.recruiterId,
                attemptId: started.attemptId,
                providerReferenceId: providerResult.providerReferenceId,
            });
            if (!persisted) {
                throw new RecruiterInvitationDeliveryPersistenceError(
                    "Provider acceptance could not be recorded; automatic retry is unsafe.",
                );
            }
            return {
                recipientId: recipient.recipientId,
                attemptId: started.attemptId,
                attemptNumber: started.attemptNumber,
                status: "provider_accepted" as const,
                retryable: false,
                failureCode: null,
            };
        } catch (error) {
            if (error instanceof RecruiterInvitationDeliveryPersistenceError) throw error;
            const providerError = error instanceof RecruiterInvitationProviderError
                ? error
                : new RecruiterInvitationProviderError("provider_outcome_unknown", false, false);
            const outcomeUnknown = !providerError.outcomeKnown;
            const persisted = await dependencies.deliveryRepository.fail({
                recruiterId: input.recruiterId,
                attemptId: started.attemptId,
                failureCode: providerError.code,
                retryable: providerError.retryable,
                outcomeUnknown,
            });
            if (!persisted) throw new RecruiterInvitationDeliveryPersistenceError("Delivery outcome could not be saved.");
            return failureResult(
                recipient.recipientId,
                started,
                providerError.code,
                providerError.retryable,
                outcomeUnknown,
            );
        }
    });

    return { batchId: input.batchId, recipients };
}

function mapClaimWithoutProviderCall(
    outcome: RecruiterInvitationDeliveryClaimOutcome,
    attempt: { attemptId: string; attemptNumber: number; lifecycleState: string; retryable: boolean; failureCode: string | null },
) {
    if ((outcome === "replayed" || outcome === "already_accepted") && attempt.lifecycleState === "provider_accepted") {
        return { attemptId: attempt.attemptId, attemptNumber: attempt.attemptNumber, status: "provider_accepted" as const, retryable: false, failureCode: null };
    }
    if (outcome === "in_progress" || (outcome === "replayed" && attempt.lifecycleState === "sending")) {
        return { attemptId: attempt.attemptId, attemptNumber: attempt.attemptNumber, status: "in_progress" as const, retryable: false, failureCode: null };
    }
    if (outcome === "outcome_unknown" || (outcome === "replayed" && attempt.lifecycleState === "outcome_unknown")) {
        return { attemptId: attempt.attemptId, attemptNumber: attempt.attemptNumber, status: "outcome_unknown" as const, retryable: false, failureCode: attempt.failureCode };
    }
    if (outcome === "replayed" && attempt.lifecycleState === "failed") {
        return { attemptId: attempt.attemptId, attemptNumber: attempt.attemptNumber, status: "failed" as const, retryable: attempt.retryable, failureCode: attempt.failureCode };
    }
    if (outcome === "not_retryable") {
        return { attemptId: attempt.attemptId, attemptNumber: attempt.attemptNumber, status: "not_retryable" as const, retryable: false, failureCode: attempt.failureCode };
    }
    return null;
}

function failureResult(
    recipientId: string,
    attempt: { attemptId: string; attemptNumber: number },
    failureCode: string,
    retryable: boolean,
    outcomeUnknown: boolean,
) {
    return {
        recipientId,
        attemptId: attempt.attemptId,
        attemptNumber: attempt.attemptNumber,
        status: outcomeUnknown ? "outcome_unknown" as const : "failed" as const,
        retryable: outcomeUnknown ? false : retryable,
        failureCode,
    };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, operation: (item: T) => Promise<R>) {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    async function worker() {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            results[index] = await operation(items[index]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}
