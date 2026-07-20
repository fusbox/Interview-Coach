import { describe, expect, it, vi } from "vitest";

import {
    hashInvitedPracticeToken,
    type InvitedPracticeTokenVault,
} from "./invited-practice-token-vault";
import { createRecruiterInvitationRepository } from "./recruiter-invitation-repository";
import {
    createRecruiterInvitationAggregate,
    RecruiterInvitationConflictError,
} from "./recruiter-invitation-service";

describe("recruiter invitation service", () => {
    it("returns the persisted winner token for created and replayed aggregates", async () => {
        const tokenVault = createTokenVault();
        const repository = createRecruiterInvitationRepository({ query: vi.fn() });
        repository.createOrReplay = vi.fn().mockResolvedValue({
            outcome: "replayed",
            batchId: "batch-winner",
        });
        repository.findOwnedAggregate = vi.fn().mockResolvedValue({
            batchId: "batch-winner",
            recruiterId: "recruiter-1",
            targetRole: "Quality Inspector",
            jobDescription: null,
            interviewStage: "screening",
            questionPlanSnapshot: input().questionPlanSnapshot,
            questionWordingSnapshot: input().questionWordingSnapshot,
            recipients: [{
                recipientId: "recipient-winner",
                candidateIndex: 0,
                firstName: "Irma",
                lastName: "Castillo",
                email: "irma@example.com",
                requisitionReference: null,
                sessionId: "session-winner",
                sessionStatus: "planned",
                attemptNumber: 1,
                tokenHash: hashInvitedPracticeToken("winner-raw-token"),
                tokenCiphertext: "winner-ciphertext",
                encryptionKeyId: "key-1",
                tokenExpiresAt: "2026-08-01T00:00:00.000Z",
            }],
        });

        const result = await createRecruiterInvitationAggregate(input(), {
            repository,
            tokenVault,
            now: new Date("2026-07-19T12:00:00.000Z"),
            createId: () => crypto.randomUUID(),
        });

        expect(result).toMatchObject({
            outcome: "replayed",
            batchId: "batch-winner",
            recipients: [{ rawToken: "winner-raw-token" }],
        });
        expect(tokenVault.decryptToken).toHaveBeenCalledWith({
            tokenCiphertext: "winner-ciphertext",
            encryptionKeyId: "key-1",
        });
    });

    it("raises a typed conflict before loading or exposing handoff material", async () => {
        const repository = createRecruiterInvitationRepository({ query: vi.fn() });
        repository.createOrReplay = vi.fn().mockResolvedValue({
            outcome: "conflict",
            batchId: "batch-existing",
        });
        repository.findOwnedAggregate = vi.fn();

        await expect(createRecruiterInvitationAggregate(input(), {
            repository,
            tokenVault: createTokenVault(),
        })).rejects.toBeInstanceOf(RecruiterInvitationConflictError);
        expect(repository.findOwnedAggregate).not.toHaveBeenCalled();
    });

    it("fails closed when recovered ciphertext does not match the persisted lookup hash", async () => {
        const repository = createRecruiterInvitationRepository({ query: vi.fn() });
        repository.createOrReplay = vi.fn().mockResolvedValue({
            outcome: "replayed",
            batchId: "batch-winner",
        });
        repository.findOwnedAggregate = vi.fn().mockResolvedValue({
            batchId: "batch-winner",
            recruiterId: "recruiter-1",
            targetRole: "Quality Inspector",
            jobDescription: null,
            interviewStage: "screening",
            questionPlanSnapshot: input().questionPlanSnapshot,
            questionWordingSnapshot: input().questionWordingSnapshot,
            recipients: [{
                recipientId: "recipient-winner",
                candidateIndex: 0,
                firstName: "Irma",
                lastName: "Castillo",
                email: "irma@example.com",
                requisitionReference: null,
                sessionId: "session-winner",
                sessionStatus: "planned",
                attemptNumber: 1,
                tokenHash: hashInvitedPracticeToken("different-token"),
                tokenCiphertext: "winner-ciphertext",
                encryptionKeyId: "key-1",
                tokenExpiresAt: "2026-08-01T00:00:00.000Z",
            }],
        });

        await expect(createRecruiterInvitationAggregate(input(), {
            repository,
            tokenVault: createTokenVault(),
        })).rejects.toThrow(/does not match/);
    });
});

function input() {
    const questionPlanSnapshot = {
        interviewStage: "screening" as const,
        questionCount: 1,
        categoryCounts: {
            screening: 1,
            behavioral: 0,
            culture_fit: 0,
            case_scenario: 0,
            technical_role_specific: 0,
        },
        slots: [{
            id: "slot-1",
            index: 0,
            category: "screening" as const,
            label: "Screening",
            purpose: "Basic fit.",
        }],
    };
    return {
        recruiterId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        idempotencyKey: "browser-action-key-0001",
        targetRole: "Quality Inspector",
        interviewStage: "screening" as const,
        questionPlanSnapshot,
        questionWordingSnapshot: {
            status: "questions_worded" as const,
            questions: [{
                slotId: "slot-1",
                index: 0,
                category: "screening" as const,
                questionText: "Why are you interested?",
            }],
        },
        recipients: [{
            firstName: "Irma",
            lastName: "Castillo",
            email: "irma@example.com",
        }],
        tokenTtlSeconds: 14 * 24 * 60 * 60,
    };
}

function createTokenVault() {
    return {
        createTokenMaterial: vi.fn(() => ({
            rawToken: "loser-raw-token",
            tokenHash: "a".repeat(64),
            tokenCiphertext: "loser-ciphertext",
            encryptionKeyId: "key-1",
        })),
        decryptToken: vi.fn(() => "winner-raw-token"),
    } satisfies InvitedPracticeTokenVault;
}
