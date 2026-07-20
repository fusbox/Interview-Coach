import { describe, expect, it, vi } from "vitest";

import { createRecruiterDashboardRepository } from "./recruiter-dashboard-repository";

describe("recruiter dashboard repository", () => {
    it("selects only recruiter-owned operational facts and excludes sensitive content", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [row()] });
        const repository = createRecruiterDashboardRepository({ query });

        await expect(repository.listOwnedRecipientFacts("20000000-0000-4000-8000-000000000001")).resolves.toEqual([
            expect.objectContaining({
                batchId: "30000000-0000-4000-8000-000000000001",
                recipientId: "40000000-0000-4000-8000-000000000001",
                sessionId: "50000000-0000-4000-8000-000000000001",
                questionCount: 5,
                answeredQuestionCount: 2,
                deliveryLifecycleState: "provider_accepted",
                entryMatchState: "match",
            }),
        ]);

        const [sql, values] = query.mock.calls[0] as [string, unknown[]];
        expect(values).toEqual(["20000000-0000-4000-8000-000000000001"]);
        expect(sql).toContain("where batch.recruiter_id = $1");
        expect(sql).toContain("recipient.recruiter_id = $1");
        expect(sql).toContain("session.recruiter_id = $1");
        expect(sql).toContain("count(distinct answer_attempt.question_slot_id)");
        expect(sql).not.toContain("answer_text");
        expect(sql).not.toContain("result_json");
        expect(sql).not.toContain("configuration_manifest_json");
        expect(sql).not.toContain("provider_reference_id");
        expect(sql).not.toContain("token_hash");
        expect(sql).not.toContain("token_ciphertext");
        expect(sql).not.toContain("session_token_hash");
        expect(sql).not.toContain("candidate_profiles");
        expect(sql).not.toContain("candidate_practice_sessions");
    });

    it("returns an empty read for a recruiter with no owned invitation rows", async () => {
        const repository = createRecruiterDashboardRepository({
            query: vi.fn().mockResolvedValue({ rows: [] }),
        });
        await expect(repository.listOwnedRecipientFacts("foreign-recruiter")).resolves.toEqual([]);
    });
});

function row() {
    return {
        recruiter_invitation_batch_id: "30000000-0000-4000-8000-000000000001",
        batch_lifecycle_state: "ready",
        target_role: "Quality Inspector",
        interview_stage: "screening",
        batch_created_at: new Date("2026-07-20T00:00:00.000Z"),
        recruiter_invitation_recipient_id: "40000000-0000-4000-8000-000000000001",
        recipient_lifecycle_state: "ready",
        candidate_index: 0,
        first_name: "Irma",
        last_name: "Castillo",
        email: "irma@example.invalid",
        requisition_reference: "REQ-1",
        invited_practice_session_id: "50000000-0000-4000-8000-000000000001",
        session_status: "in_progress",
        session_attempt_number: 1,
        question_count: 5,
        answered_question_count: 2,
        completed_at: null,
        delivery_lifecycle_state: "provider_accepted",
        delivery_attempt_number: 1,
        delivery_retryable: false,
        entry_match_state: "match",
        first_opened_at: new Date("2026-07-20T00:10:00.000Z"),
        last_activity_at: new Date("2026-07-20T00:20:00.000Z"),
    };
}
