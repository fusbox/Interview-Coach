import { describe, expect, it, vi } from "vitest";

import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import { createRecruiterInvitationQuestionSetRepository } from "./recruiter-invitation-question-set-repository";

describe("recruiter invitation question-set repository", () => {
    it("claims through active recruiter authorization and stores only the action-key hash", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [row("preparing", "claimed")] });
        const repository = createRecruiterInvitationQuestionSetRepository({ query });

        const result = await repository.claim({
            questionSetId: QUESTION_SET_ID,
            recruiterId: RECRUITER_ID,
            actionKeyHash: "a".repeat(64),
            requestFingerprint: "b".repeat(64),
            source: "generated",
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished goods.",
            interviewStage: "screening",
            questionPlanSnapshot: plan(),
            expiresAt: "2026-07-20T18:00:00.000Z",
        });

        expect(result.outcome).toBe("claimed");
        const [sql, values] = query.mock.calls[0];
        expect(sql).toContain("app_role.role in ('recruiter', 'admin')");
        expect(sql).toContain("on conflict (recruiter_id, action_key_hash) do nothing");
        expect(values).toContain("a".repeat(64));
        expect(JSON.stringify(values)).not.toContain("browser-action-key");
    });

    it("loads a ready set only through recruiter, question-set, action, state, and expiry scope", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [row("ready")] });
        const repository = createRecruiterInvitationQuestionSetRepository({ query });
        const result = await repository.findOwnedReady({
            questionSetId: QUESTION_SET_ID,
            recruiterId: RECRUITER_ID,
            actionKeyHash: "a".repeat(64),
        });

        expect(result?.questionWordingSnapshot?.questions).toHaveLength(5);
        const [sql, values] = query.mock.calls[0];
        expect(sql).toContain("question_set.recruiter_id = $2");
        expect(sql).toContain("question_set.action_key_hash = $3");
        expect(sql).toContain("question_set.lifecycle_state = 'ready'");
        expect(sql).toContain("question_set.expires_at > now()");
        expect(values).toEqual([QUESTION_SET_ID, RECRUITER_ID, "a".repeat(64)]);
    });

    it("re-reads the committed winner when an insert race is absent from the statement snapshot", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [row("preparing", "in_progress")] });
        const repository = createRecruiterInvitationQuestionSetRepository({ query });

        const result = await repository.claim({
            questionSetId: QUESTION_SET_ID,
            recruiterId: RECRUITER_ID,
            actionKeyHash: "a".repeat(64),
            requestFingerprint: "b".repeat(64),
            source: "generated",
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished goods.",
            interviewStage: "screening",
            questionPlanSnapshot: plan(),
            expiresAt: "2026-07-20T18:00:00.000Z",
        });

        expect(result.outcome).toBe("in_progress");
        expect(query).toHaveBeenCalledTimes(2);
        expect(query.mock.calls[1][0]).toContain("existing.action_key_hash = $2");
    });
});

const RECRUITER_ID = "20000000-0000-4000-8000-000000000001";
const QUESTION_SET_ID = "30000000-0000-4000-8000-000000000001";

function plan() {
    return createCandidateQuestionPlan({ interviewStage: "screening", questionCount: 5 });
}

function row(lifecycleState: "preparing" | "ready", outcome?: string) {
    const questionPlan = plan();
    return {
        claim_outcome: outcome,
        recruiter_invitation_question_set_id: QUESTION_SET_ID,
        recruiter_id: RECRUITER_ID,
        action_key_hash: "a".repeat(64),
        request_fingerprint: "b".repeat(64),
        source: "generated",
        lifecycle_state: lifecycleState,
        target_role: "Quality Inspector",
        job_description: "Inspect finished goods.",
        interview_stage: "screening",
        question_plan_snapshot_json: questionPlan,
        question_wording_snapshot_json: lifecycleState === "ready" ? {
            status: "questions_worded",
            questions: questionPlan.slots.map((slot) => ({
                slotId: slot.id,
                index: slot.index,
                category: slot.category,
                questionText: `Question ${slot.index + 1}?`,
            })),
        } : null,
        expires_at: new Date("2026-07-20T18:00:00.000Z"),
    };
}
