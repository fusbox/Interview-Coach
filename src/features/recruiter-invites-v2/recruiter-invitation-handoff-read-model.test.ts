import { describe, expect, it, vi } from "vitest";

import type { InvitedPracticeTokenVault } from "./invited-practice-token-vault";
import {
    createRecruiterInvitationHandoffReadModel,
    type RecruiterInvitationHandoffDeliveryFact,
    type RecruiterInvitationHandoffFact,
    type RecruiterInvitationHandoffRecipientFact,
} from "./recruiter-invitation-handoff-read-model";

const NOW = new Date("2026-07-20T12:00:00.000Z");

describe("recruiter invitation handoff read model", () => {
    it("recovers active links and exposes only never-sent and safe-failure work as actions", () => {
        const model = build([
            recipient("not-sent"),
            recipient("retry", delivery("failed", { retryable: true })),
            recipient("accepted", delivery("provider_accepted")),
            recipient("unknown", delivery("outcome_unknown")),
        ]);

        expect(model.sendEligibleCount).toBe(1);
        expect(model.retryEligibleCount).toBe(1);
        expect(model.recipients.find((item) => item.recipientId === "accepted")?.actionEligibility).toBeNull();
        expect(model.recipients.find((item) => item.recipientId === "unknown")?.actionEligibility).toBeNull();
        expect(find(model, "not-sent")?.inviteLink).toBe("https://interviewcoach.example/s/raw-not-sent");
        expect(find(model, "not-sent")?.copyMessage).toContain("Interview Coach practice round");
    });

    it("matches the five-minute queued recovery and ten-minute sending quarantine", () => {
        const model = build([
            recipient("fresh-queue", delivery("queued", { queuedAt: "2026-07-20T11:56:00.001Z" })),
            recipient("stale-queue", delivery("queued", { queuedAt: "2026-07-20T11:55:00.000Z" })),
            recipient("fresh-send", delivery("sending", { startedAt: "2026-07-20T11:50:00.001Z" })),
            recipient("stale-send", delivery("sending", { startedAt: "2026-07-20T11:50:00.000Z" })),
        ]);

        expect(find(model, "fresh-queue")).toMatchObject({ deliveryState: "queued", actionEligibility: null });
        expect(find(model, "stale-queue")).toMatchObject({ deliveryState: "failed_retryable", actionEligibility: "retry" });
        expect(find(model, "fresh-send")).toMatchObject({ deliveryState: "sending", actionEligibility: null });
        expect(find(model, "stale-send")).toMatchObject({ deliveryState: "outcome_unknown", actionEligibility: null });
    });

    it("suppresses bearer recovery and actions for expired, revoked, and undecryptable links", () => {
        const vault = tokenVault();
        vi.mocked(vault.decryptToken).mockImplementation(({ tokenCiphertext }) => {
            if (tokenCiphertext === "cipher-bad-key") throw new Error("key unavailable");
            return tokenCiphertext.replace("cipher-", "raw-");
        });
        const model = build([
            { ...recipient("expired"), tokenExpiresAt: NOW.toISOString() },
            { ...recipient("revoked"), tokenRevokedAt: "2026-07-20T11:00:00.000Z" },
            { ...recipient("bad-key"), tokenCiphertext: "cipher-bad-key" },
        ], vault);

        expect(find(model, "expired")).toMatchObject({ linkAvailability: "expired", inviteLink: null, actionEligibility: null });
        expect(find(model, "revoked")).toMatchObject({ linkAvailability: "revoked", inviteLink: null, actionEligibility: null });
        expect(find(model, "bad-key")).toMatchObject({ linkAvailability: "unavailable", inviteLink: null, actionEligibility: null });
        expect(JSON.stringify(model)).not.toContain("cipher-");
    });
});

function build(recipients: RecruiterInvitationHandoffRecipientFact[], vault = tokenVault()) {
    const fact: RecruiterInvitationHandoffFact = {
        batchId: "batch-1",
        batchLifecycleState: "ready",
        targetRole: "Quality Inspector",
        interviewStage: "screening",
        recipientCount: recipients.length,
        batchCreatedAt: "2026-07-20T10:00:00.000Z",
        batchUpdatedAt: "2026-07-20T10:00:00.000Z",
        recipients,
    };
    return createRecruiterInvitationHandoffReadModel(fact, {
        appOrigin: "https://interviewcoach.example",
        recruiterName: "Dev Recruiter",
        tokenVault: vault,
        now: NOW,
    });
}

function recipient(id: string, currentDelivery: RecruiterInvitationHandoffDeliveryFact | null = null): RecruiterInvitationHandoffRecipientFact {
    return {
        recipientId: id,
        recipientLifecycleState: "ready",
        candidateIndex: Number(id.length),
        firstName: "Irma",
        lastName: id,
        email: `${id}@example.invalid`,
        requisitionReference: null,
        sessionId: `session-${id}`,
        sessionStatus: "planned",
        sessionAttemptNumber: 1,
        tokenCiphertext: `cipher-${id}`,
        encryptionKeyId: "key-1",
        tokenExpiresAt: "2026-07-27T12:00:00.000Z",
        tokenRevokedAt: null,
        delivery: currentDelivery,
    };
}

function delivery(
    lifecycleState: RecruiterInvitationHandoffDeliveryFact["lifecycleState"],
    overrides: Partial<RecruiterInvitationHandoffDeliveryFact> = {},
): RecruiterInvitationHandoffDeliveryFact {
    return {
        attemptId: `attempt-${lifecycleState}`,
        attemptNumber: 1,
        lifecycleState,
        retryable: false,
        failureCode: null,
        queuedAt: "2026-07-20T11:59:00.000Z",
        startedAt: lifecycleState === "sending" ? "2026-07-20T11:59:01.000Z" : null,
        completedAt: lifecycleState === "provider_accepted" || lifecycleState === "failed" || lifecycleState === "outcome_unknown"
            ? "2026-07-20T11:59:02.000Z"
            : null,
        updatedAt: "2026-07-20T11:59:02.000Z",
        ...overrides,
    };
}

function tokenVault() {
    return {
        createTokenMaterial: vi.fn(),
        decryptToken: vi.fn(({ tokenCiphertext }: { tokenCiphertext: string }) => tokenCiphertext.replace("cipher-", "raw-")),
    } as unknown as InvitedPracticeTokenVault;
}

function find(model: ReturnType<typeof build>, recipientId: string) {
    return model.recipients.find((recipient) => recipient.recipientId === recipientId);
}
