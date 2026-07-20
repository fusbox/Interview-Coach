import { describe, expect, it } from "vitest";

import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import type { InvitedPracticeTokenVault } from "./invited-practice-token-vault";
import {
    prepareRecruiterInvitationAggregate,
    type CreateRecruiterInvitationAggregateInput,
} from "./recruiter-invitation-contract";

describe("recruiter invitation aggregate contract", () => {
    it("fingerprints semantic content while excluding generated ids and token material", () => {
        const first = prepareRecruiterInvitationAggregate(createInput(), {
            tokenVault: createTokenVault("first"),
            now: new Date("2026-07-19T12:00:00.000Z"),
            createId: createSequentialId("10000000"),
        });
        const second = prepareRecruiterInvitationAggregate(createInput(), {
            tokenVault: createTokenVault("second"),
            now: new Date("2026-07-19T12:01:00.000Z"),
            createId: createSequentialId("20000000"),
        });

        expect(second.requestFingerprint).toBe(first.requestFingerprint);
        expect(second.idempotencyKeyHash).toBe(first.idempotencyKeyHash);
        expect(second.batchId).not.toBe(first.batchId);
        expect(second.recipients[0].tokenHash).not.toBe(first.recipients[0].tokenHash);
        expect(second.recipients[0].tokenExpiresAt).not.toBe(first.recipients[0].tokenExpiresAt);
    });

    it("normalizes recipient identity and rejects duplicate recipients or mismatched wording", () => {
        const normalized = prepareRecruiterInvitationAggregate(createInput(), {
            tokenVault: createTokenVault("token"),
            now: new Date("2026-07-19T12:00:00.000Z"),
            createId: createSequentialId("30000000"),
        });
        expect(normalized.recipients[0]).toMatchObject({
            candidateIndex: 0,
            firstName: "Irma",
            lastName: "Castillo",
            email: "irma@example.com",
        });

        const duplicate = createInput();
        duplicate.recipients.push({
            firstName: "Other",
            lastName: "Person",
            email: "IRMA@example.com",
        });
        expect(() => prepareRecruiterInvitationAggregate(duplicate, {
            tokenVault: createTokenVault("token"),
        })).toThrow(/unique/);

        const mismatched = createInput();
        mismatched.questionWordingSnapshot = {
            ...mismatched.questionWordingSnapshot,
            questions: [],
        };
        expect(() => prepareRecruiterInvitationAggregate(mismatched, {
            tokenVault: createTokenVault("token"),
        })).toThrow(/map exactly/);
    });
});

function createInput(): CreateRecruiterInvitationAggregateInput {
    const questionPlanSnapshot = createCandidateQuestionPlan({
        interviewStage: "screening",
        questionCount: 2,
    });
    return {
        recruiterId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        idempotencyKey: "browser-action-key-0001",
        targetRole: " Quality Inspector ",
        jobDescription: " Inspect packaged goods. ",
        interviewStage: "screening" as const,
        questionPlanSnapshot,
        questionWordingSnapshot: {
            status: "questions_worded" as const,
            questions: questionPlanSnapshot.slots.map((slot) => ({
                slotId: slot.id,
                index: slot.index,
                category: slot.category,
                questionText: `Question ${slot.index + 1}?`,
            })),
        },
        recipients: [{
            firstName: " Irma ",
            lastName: " Castillo ",
            email: " IRMA@example.com ",
            requisitionReference: "REQ-100",
            resumeText: "Inspected outbound packages.",
        }],
        tokenTtlSeconds: 14 * 24 * 60 * 60,
    };
}

function createTokenVault(prefix: string): InvitedPracticeTokenVault {
    let count = 0;
    return {
        createTokenMaterial() {
            count += 1;
            return {
                rawToken: `${prefix}-raw-${count}`,
                tokenHash: `${count}`.padStart(64, prefix === "first" ? "a" : "b"),
                tokenCiphertext: `${prefix}-ciphertext-${count}`,
                encryptionKeyId: "test-key",
            };
        },
        decryptToken() {
            return `${prefix}-raw-${count}`;
        },
    };
}

function createSequentialId(prefix: string) {
    let count = 0;
    return () => {
        count += 1;
        return `${prefix}-0000-4000-8000-${String(count).padStart(12, "0")}`;
    };
}
