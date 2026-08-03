import { describe, expect, it, vi } from "vitest";

import { RecruiterInvitationProviderError } from "./recruiter-invitation-delivery-provider";
import type {
    RecruiterInvitationDeliveryLifecycleState,
    RecruiterInvitationDeliveryRepository,
} from "./recruiter-invitation-delivery-repository";
import {
    deliverRecruiterInvitationBatch,
    RecruiterInvitationDeliveryPersistenceError,
} from "./recruiter-invitation-delivery-service";

describe("recruiter invitation delivery service", () => {
    it("sends a candidate-specific message per recipient and records provider acceptance", async () => {
        const dependencies = createDependencies();
        const result = await deliverRecruiterInvitationBatch(input(), asDeliveryDependencies(dependencies));

        expect(result.recipients.map((recipient) => recipient.status)).toEqual([
            "provider_accepted",
            "provider_accepted",
        ]);
        expect(dependencies.provider.send).toHaveBeenCalledTimes(2);
        expect(dependencies.provider.send).toHaveBeenNthCalledWith(1, expect.objectContaining({
            recipientEmail: "irma@example.com",
            message: expect.objectContaining({ text: expect.stringContaining("/s/token-recipient-1") }),
        }));
        expect(dependencies.provider.send).toHaveBeenNthCalledWith(2, expect.objectContaining({
            recipientEmail: "sam@example.com",
            message: expect.objectContaining({ text: expect.stringContaining("/s/token-recipient-2") }),
        }));
        expect(dependencies.deliveryRepository.accept).toHaveBeenCalledTimes(2);
    });

    it("skips an already accepted recipient while retrying only a retryable failed recipient", async () => {
        const dependencies = createDependencies();
        dependencies.deliveryRepository.claim
            .mockResolvedValueOnce({ outcome: "already_accepted", attempt: attempt("accepted-1", 1, "provider_accepted") })
            .mockResolvedValueOnce({ outcome: "claimed", attempt: attempt("retry-2", 2, "queued") });

        const result = await deliverRecruiterInvitationBatch(input(), asDeliveryDependencies(dependencies));

        expect(result.recipients.map((recipient) => recipient.status)).toEqual([
            "provider_accepted",
            "provider_accepted",
        ]);
        expect(dependencies.provider.send).toHaveBeenCalledTimes(1);
        expect(dependencies.provider.send).toHaveBeenCalledWith(expect.objectContaining({ recipientEmail: "sam@example.com" }));
    });

    it("records an indeterminate provider exception as outcome unknown and never retryable", async () => {
        const dependencies = createDependencies({ recipientCount: 1 });
        dependencies.provider.send.mockRejectedValue(
            new RecruiterInvitationProviderError("smtp_outcome_unknown", false, false),
        );

        const result = await deliverRecruiterInvitationBatch(input(), asDeliveryDependencies(dependencies));

        expect(result.recipients[0]).toMatchObject({
            status: "outcome_unknown",
            retryable: false,
            failureCode: "smtp_outcome_unknown",
        });
        expect(dependencies.deliveryRepository.fail).toHaveBeenCalledWith(expect.objectContaining({
            outcomeUnknown: true,
            retryable: false,
        }));
    });

    it("replays the same failed action without invoking the provider again", async () => {
        const dependencies = createDependencies({ recipientCount: 1 });
        dependencies.deliveryRepository.claim.mockResolvedValue({
            outcome: "replayed",
            attempt: { ...attempt("attempt-1", 1, "failed"), retryable: true, failureCode: "provider_not_configured" },
        });

        const result = await deliverRecruiterInvitationBatch(input(), asDeliveryDependencies(dependencies));

        expect(result.recipients[0]).toMatchObject({ status: "failed", retryable: true });
        expect(dependencies.provider.send).not.toHaveBeenCalled();
    });

    it("leaves a provider-accepted but unrecorded invocation blocked instead of sending again", async () => {
        const dependencies = createDependencies({ recipientCount: 1 });
        dependencies.deliveryRepository.accept.mockResolvedValue(false);

        await expect(deliverRecruiterInvitationBatch(input(), asDeliveryDependencies(dependencies)))
            .rejects.toBeInstanceOf(RecruiterInvitationDeliveryPersistenceError);
        expect(dependencies.deliveryRepository.fail).not.toHaveBeenCalled();
    });

    it("does not claim or send a revoked or expired recipient link", async () => {
        const dependencies = createDependencies();
        dependencies.invitationRepository.findOwnedAggregate.mockResolvedValue({
            batchId: "batch-1",
            recruiterId: "recruiter-1",
            batchLifecycleState: "ready",
            targetRole: "Quality Inspector",
            jobDescription: "Inspect goods.",
            interviewStage: "screening",
            questionPlanSnapshot: {},
            questionWordingSnapshot: {},
            recipients: [
                { ...recipient("expired", "Irma", "irma@example.com"), tokenExpiresAt: "2020-01-01T00:00:00.000Z" },
                { ...recipient("revoked", "Sam", "sam@example.com"), recipientLifecycleState: "revoked" },
            ],
        });

        const result = await deliverRecruiterInvitationBatch(input(), asDeliveryDependencies(dependencies));

        expect(result.recipients).toEqual([
            expect.objectContaining({ recipientId: "expired", status: "not_retryable", failureCode: "invitation_inactive" }),
            expect.objectContaining({ recipientId: "revoked", status: "not_retryable", failureCode: "invitation_inactive" }),
        ]);
        expect(dependencies.deliveryRepository.claim).not.toHaveBeenCalled();
        expect(dependencies.provider.send).not.toHaveBeenCalled();
    });
});

function createDependencies(options: { recipientCount?: number } = {}) {
    const recipients = [
        recipient("recipient-1", "Irma", "irma@example.com"),
        recipient("recipient-2", "Sam", "sam@example.com"),
    ].slice(0, options.recipientCount ?? 2);
    let attemptIndex = 0;
    type ClaimResult = Awaited<ReturnType<RecruiterInvitationDeliveryRepository["claim"]>>;
    const claim = vi.fn<(input: unknown) => Promise<ClaimResult>>(async () => {
            attemptIndex += 1;
            return { outcome: "claimed" as const, attempt: attempt(`attempt-${attemptIndex}`, 1, "queued") };
        });
    const deliveryRepository = {
        claim,
        start: vi.fn(async ({ attemptId }: { attemptId: string }) => attempt(attemptId, 1, "sending")),
        accept: vi.fn().mockResolvedValue(true),
        fail: vi.fn().mockResolvedValue(true),
    };
    const provider = {
        name: "fixture",
        send: vi.fn(async ({ attemptId }: { attemptId: string }) => ({ providerReferenceId: `provider-${attemptId}` })),
    };
    return {
        invitationRepository: {
            findOwnedAggregate: vi.fn().mockResolvedValue({
                batchId: "batch-1",
                recruiterId: "recruiter-1",
                targetRole: "Quality Inspector",
                jobDescription: "Inspect goods.",
                interviewStage: "screening",
                questionPlanSnapshot: {},
                questionWordingSnapshot: {},
                recipients,
            }),
        },
        deliveryRepository,
        provider,
        tokenVault: {
            createTokenMaterial: vi.fn(),
            decryptToken: vi.fn(({ tokenCiphertext }: { tokenCiphertext: string }) => tokenCiphertext),
        },
        createAttemptId: () => `new-attempt-${attemptIndex + 1}`,
    };
}

function asDeliveryDependencies(value: ReturnType<typeof createDependencies>) {
    return value as unknown as Parameters<typeof deliverRecruiterInvitationBatch>[1];
}

function input() {
    return {
        recruiterId: "recruiter-1",
        recruiterName: "Dev Recruiter",
        batchId: "batch-1",
        actionKey: "delivery-action-key-0001",
        appOrigin: "https://interviewcoach.example",
    };
}

function attempt(attemptId: string, attemptNumber: number, lifecycleState: RecruiterInvitationDeliveryLifecycleState) {
    return { attemptId, attemptNumber, lifecycleState, retryable: false, failureCode: null };
}

function recipient(recipientId: string, firstName: string, email: string) {
    return {
        recipientId,
        candidateIndex: 0,
        firstName,
        lastName: "Candidate",
        email,
        requisitionReference: null,
        sessionId: `session-${recipientId}`,
        sessionStatus: "planned",
        attemptNumber: 1,
        tokenHash: "a".repeat(64),
        tokenCiphertext: `token-${recipientId}`,
        encryptionKeyId: "key",
        tokenExpiresAt: "2099-08-01T00:00:00.000Z",
    };
}
