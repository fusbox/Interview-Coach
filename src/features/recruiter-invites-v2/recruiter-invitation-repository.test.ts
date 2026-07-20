import { describe, expect, it, vi } from "vitest";

import { createRecruiterInvitationRepository } from "./recruiter-invitation-repository";

describe("recruiter invitation repository", () => {
    it("persists through the atomic function without passing plaintext token material", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{
                creation_outcome: "created",
                recruiter_invitation_batch_id: "batch-1",
            }],
        });
        const repository = createRecruiterInvitationRepository({ query });

        const result = await repository.createOrReplay({
            recruiterId: "recruiter-1",
            idempotencyKeyHash: "a".repeat(64),
            requestFingerprint: "b".repeat(64),
            batchId: "batch-1",
            targetRole: "Quality Inspector",
            jobDescription: "Inspect goods.",
            interviewStage: "screening",
            questionPlanSnapshot: plan(),
            questionWordingSnapshot: wording(),
            recipients: [{
                candidateIndex: 0,
                recipientId: "recipient-1",
                sessionId: "session-1",
                firstName: "Irma",
                lastName: "Castillo",
                email: "irma@example.com",
                requisitionReference: null,
                resumeText: null,
                tokenHash: "c".repeat(64),
                tokenCiphertext: "v1.key.iv.tag.encrypted",
                encryptionKeyId: "key",
                tokenExpiresAt: "2026-08-01T00:00:00.000Z",
            }],
        });

        expect(result).toEqual({ outcome: "created", batchId: "batch-1" });
        const [sql, values] = query.mock.calls[0];
        expect(sql).toContain("create_recruiter_invitation_aggregate");
        expect(JSON.stringify(values)).not.toContain("rawToken");
        expect(JSON.stringify(values)).not.toContain("/s/");
    });

    it("links route-created aggregates to the owned accepted question set atomically", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{ creation_outcome: "created", recruiter_invitation_batch_id: "batch-1" }],
        });
        const repository = createRecruiterInvitationRepository({ query });

        await repository.createOrReplayFromQuestionSet({
            ...aggregateInput(),
            sourceQuestionSetId: "30000000-0000-4000-8000-000000000001",
        });

        const [sql, values] = query.mock.calls[0];
        expect(sql).toContain("create_recruiter_invitation_aggregate_from_question_set");
        expect(values[0]).toBe("30000000-0000-4000-8000-000000000001");
    });

    it("requires recruiter ownership on every aggregate join and denies a missing owner", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [] });
        const repository = createRecruiterInvitationRepository({ query });

        await expect(repository.findOwnedAggregate({
            recruiterId: "other-recruiter",
            batchId: "batch-1",
        })).resolves.toBeNull();

        const [sql, values] = query.mock.calls[0];
        expect(sql).toMatch(/batch\.recruiter_id = \$2/);
        expect(sql).toMatch(/recipient\.recruiter_id = \$2/);
        expect(sql).toMatch(/session\.recruiter_id = \$2/);
        expect(values).toEqual(["batch-1", "other-recruiter"]);
    });

    it("resolves bearer access only through invited tables and active token state", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [] });
        const repository = createRecruiterInvitationRepository({ query });

        await repository.findSessionByTokenHash("d".repeat(64));

        const [sql] = query.mock.calls[0];
        expect(sql).toContain("invited_practice_access_tokens");
        expect(sql).toContain("token.revoked_at is null");
        expect(sql).toContain("token.expires_at > now()");
        expect(sql).not.toContain("candidate_profiles");
        expect(sql).not.toContain("candidate_practice_sessions");
    });
});

function plan() {
    return {
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
}

function wording() {
    return {
        status: "questions_worded" as const,
        questions: [{
            slotId: "slot-1",
            index: 0,
            category: "screening" as const,
            questionText: "Why are you interested?",
        }],
    };
}

function aggregateInput() {
    return {
        recruiterId: "20000000-0000-4000-8000-000000000001",
        idempotencyKeyHash: "a".repeat(64),
        requestFingerprint: "b".repeat(64),
        batchId: "40000000-0000-4000-8000-000000000001",
        targetRole: "Quality Inspector",
        jobDescription: "Inspect goods.",
        interviewStage: "screening" as const,
        questionPlanSnapshot: plan(),
        questionWordingSnapshot: wording(),
        recipients: [{
            candidateIndex: 0,
            recipientId: "50000000-0000-4000-8000-000000000001",
            sessionId: "60000000-0000-4000-8000-000000000001",
            firstName: "Irma",
            lastName: "Castillo",
            email: "irma@example.com",
            requisitionReference: null,
            resumeText: null,
            tokenHash: "c".repeat(64),
            tokenCiphertext: "v1.key.iv.tag.encrypted",
            encryptionKeyId: "key",
            tokenExpiresAt: "2026-08-01T00:00:00.000Z",
        }],
    };
}
