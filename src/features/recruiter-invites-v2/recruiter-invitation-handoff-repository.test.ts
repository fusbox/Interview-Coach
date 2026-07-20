import { describe, expect, it, vi } from "vitest";

import { createRecruiterInvitationHandoffRepository } from "./recruiter-invitation-handoff-repository";

describe("recruiter invitation handoff repository", () => {
    it("fences every ownership-bearing join and selects only the latest session and delivery attempt", async () => {
        const client = { query: vi.fn().mockResolvedValue({ rows: [row()] }) };
        const fact = await createRecruiterInvitationHandoffRepository(client).findOwnedHandoffFact(
            "recruiter-1",
            "batch-1",
        );

        expect(fact).toMatchObject({
            batchId: "batch-1",
            recipientCount: 1,
            recipients: [{
                recipientId: "recipient-1",
                delivery: { attemptId: "delivery-2", attemptNumber: 2, lifecycleState: "failed" },
            }],
        });
        const [sql, values] = client.query.mock.calls[0];
        expect(values).toEqual(["recruiter-1", "batch-1"]);
        expect(sql).toContain("batch.recruiter_id = $1");
        expect(sql).toContain("recipient.recruiter_id = $1");
        expect(sql).toContain("owned_session.recruiter_id = $1");
        expect(sql).toContain("owned_delivery.recruiter_id = $1");
        expect(sql).toContain("order by owned_session.attempt_number desc");
        expect(sql).toContain("order by owned_delivery.attempt_number desc");
        expect(sql).not.toMatch(/provider_reference_id|answer_text|answer_drafts|coaching|evaluator|latency|token_hash/);
    });

    it("returns one not-found fact for an unknown or foreign-owned batch", async () => {
        const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
        await expect(createRecruiterInvitationHandoffRepository(client).findOwnedHandoffFact(
            "recruiter-2",
            "batch-1",
        )).resolves.toBeNull();
    });

    it("fails closed when the batch recipient count and owned rows diverge", async () => {
        const client = { query: vi.fn().mockResolvedValue({ rows: [{ ...row(), recipient_count: 2 }] }) };
        await expect(createRecruiterInvitationHandoffRepository(client).findOwnedHandoffFact(
            "recruiter-1",
            "batch-1",
        )).rejects.toThrow(/incomplete recipient set/i);
    });
});

function row(): Record<string, unknown> {
    return {
        recruiter_invitation_batch_id: "batch-1",
        batch_lifecycle_state: "ready",
        target_role: "Quality Inspector",
        interview_stage: "screening",
        recipient_count: 1,
        batch_created_at: "2026-07-20T10:00:00.000Z",
        batch_updated_at: "2026-07-20T10:01:00.000Z",
        recruiter_invitation_recipient_id: "recipient-1",
        recipient_lifecycle_state: "ready",
        candidate_index: 0,
        first_name: "Irma",
        last_name: "Castillo",
        email: "irma@example.invalid",
        requisition_reference: "REQ-10",
        invited_practice_session_id: "session-2",
        session_status: "in_progress",
        session_attempt_number: 2,
        token_ciphertext: "ciphertext",
        encryption_key_id: "key-1",
        token_expires_at: "2026-07-27T10:00:00.000Z",
        token_revoked_at: null,
        recruiter_invitation_delivery_attempt_id: "delivery-2",
        delivery_attempt_number: 2,
        delivery_lifecycle_state: "failed",
        delivery_retryable: true,
        delivery_failure_code: "provider_unavailable",
        delivery_queued_at: "2026-07-20T10:00:00.000Z",
        delivery_started_at: "2026-07-20T10:00:01.000Z",
        delivery_completed_at: "2026-07-20T10:00:02.000Z",
        delivery_updated_at: "2026-07-20T10:00:02.000Z",
    };
}
