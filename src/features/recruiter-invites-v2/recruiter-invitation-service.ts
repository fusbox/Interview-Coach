import {
    hashInvitedPracticeToken,
    type InvitedPracticeTokenVault,
} from "./invited-practice-token-vault";
import {
    prepareRecruiterInvitationAggregate,
    type CreateRecruiterInvitationAggregateInput,
} from "./recruiter-invitation-contract";
import type { RecruiterInvitationRepository } from "./recruiter-invitation-repository";

export class RecruiterInvitationConflictError extends Error {
    constructor() {
        super("Invitation idempotency key was already used with different content.");
        this.name = "RecruiterInvitationConflictError";
    }
}

export async function createRecruiterInvitationAggregate(
    input: CreateRecruiterInvitationAggregateInput,
    dependencies: {
        repository: RecruiterInvitationRepository;
        tokenVault: InvitedPracticeTokenVault;
        sourceQuestionSetId?: string;
        now?: Date;
        createId?: () => string;
    },
) {
    const prepared = prepareRecruiterInvitationAggregate(input, dependencies);
    const creation = dependencies.sourceQuestionSetId
        ? await dependencies.repository.createOrReplayFromQuestionSet({
            ...prepared,
            sourceQuestionSetId: dependencies.sourceQuestionSetId,
        })
        : await dependencies.repository.createOrReplay(prepared);
    if (creation.outcome === "conflict") {
        throw new RecruiterInvitationConflictError();
    }

    const aggregate = await dependencies.repository.findOwnedAggregate({
        recruiterId: input.recruiterId,
        batchId: creation.batchId,
    });
    if (!aggregate) {
        throw new Error("Created invitation aggregate could not be recovered for its recruiter owner.");
    }

    return {
        outcome: creation.outcome,
        batchId: aggregate.batchId,
        targetRole: aggregate.targetRole,
        recipients: aggregate.recipients.map((recipient) => {
            const rawToken = dependencies.tokenVault.decryptToken({
                tokenCiphertext: recipient.tokenCiphertext,
                encryptionKeyId: recipient.encryptionKeyId,
            });
            if (hashInvitedPracticeToken(rawToken) !== recipient.tokenHash) {
                throw new Error("Recovered invitation token does not match its durable lookup identity.");
            }
            return {
                recipientId: recipient.recipientId,
                sessionId: recipient.sessionId,
                firstName: recipient.firstName,
                lastName: recipient.lastName,
                email: recipient.email,
                rawToken,
                tokenExpiresAt: recipient.tokenExpiresAt,
            };
        }),
    };
}
