import { describe, expect, it, vi } from "vitest";

import { createRecruiterInvitationDeliveryRepository } from "./recruiter-invitation-delivery-repository";

describe("recruiter invitation delivery repository", () => {
    it("claims through the ownership-fenced database function with only a hashed action key", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [{
            claim_outcome: "claimed",
            delivery_attempt_id: "attempt-1",
            delivery_attempt_number: 1,
            delivery_lifecycle_state: "queued",
            delivery_retryable: false,
            delivery_failure_code: null,
        }] });
        const repository = createRecruiterInvitationDeliveryRepository({ query });

        await expect(repository.claim({
            recruiterId: "recruiter-1",
            batchId: "batch-1",
            recipientId: "recipient-1",
            attemptId: "attempt-1",
            actionKeyHash: "a".repeat(64),
            provider: "smtp",
        })).resolves.toMatchObject({ outcome: "claimed", attempt: { attemptNumber: 1 } });

        const [sql, values] = query.mock.calls[0];
        expect(sql).toContain("claim_recruiter_invitation_delivery_attempt");
        expect(values).toContain("a".repeat(64));
        expect(JSON.stringify(values)).not.toContain("raw");
    });

    it("fences acceptance to an owned sending attempt", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [{ recruiter_invitation_delivery_attempt_id: "attempt-1" }] });
        const repository = createRecruiterInvitationDeliveryRepository({ query });

        await expect(repository.accept({
            recruiterId: "recruiter-1",
            attemptId: "attempt-1",
            providerReferenceId: "provider-ref-1",
        })).resolves.toBe(true);

        const [sql] = query.mock.calls[0];
        expect(sql).toContain("lifecycle_state = 'sending'");
        expect(sql).toContain("recruiter_id = $2");
    });
});
