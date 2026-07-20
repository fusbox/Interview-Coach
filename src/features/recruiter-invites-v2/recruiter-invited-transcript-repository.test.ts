import { describe, expect, it, vi } from "vitest";

import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import { createFixtureCandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";
import { createRecruiterInvitedTranscriptRepository } from "./recruiter-invited-transcript-repository";

describe("recruiter invited transcript repository", () => {
    it("requires exact recruiter ownership and selects only the latest submitted transcript per question", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [row()] });
        const repository = createRecruiterInvitedTranscriptRepository({ query });

        await expect(repository.findOwnedTranscriptFact("recruiter-1", "session-1")).resolves.toEqual(
            expect.objectContaining({
                sessionId: "session-1",
                recipientId: "recipient-1",
                latestAnswers: [
                    { questionSlotId: "slot-1", questionIndex: 0, answerText: "Latest submitted response." },
                ],
            }),
        );

        const [sql, values] = query.mock.calls[0] as [string, unknown[]];
        expect(values).toEqual(["recruiter-1", "session-1"]);
        expect(sql).toContain("session.recruiter_id = $1");
        expect(sql).toContain("recipient.recruiter_id = $1");
        expect(sql).toContain("batch.recruiter_id = $1");
        expect(sql).toContain("distinct on (answer_attempt.question_slot_id)");
        expect(sql).toContain("answer_attempt.attempt_number desc");
        expect(sql).toContain("answer_attempt.answer_text");
        expect(sql).toContain("session.question_wording_snapshot_json -> 'questions'");
        expect(sql).not.toContain("session.question_wording_snapshot_json,");
        expect(sql).not.toContain("answer_drafts_json");
        expect(sql).not.toContain("answer_analysis_snapshots_json");
        expect(sql).not.toContain("feedback_actions_json");
        expect(sql).not.toContain("invited_practice_answer_evaluation_runs");
        expect(sql).not.toContain("candidate_profiles");
        expect(sql).not.toContain("candidate_practice_sessions");
        expect(sql).not.toContain("token_hash");
        expect(sql).not.toContain("token_ciphertext");
        expect(sql).not.toContain("submitted_at");
    });

    it("returns the same empty boundary for unknown and foreign-owned session ids", async () => {
        const repository = createRecruiterInvitedTranscriptRepository({
            query: vi.fn().mockResolvedValue({ rows: [] }),
        });
        await expect(repository.findOwnedTranscriptFact("foreign-recruiter", "session-1")).resolves.toBeNull();
    });
});

function row() {
    const questionPlanSnapshot = createCandidateQuestionPlan({ interviewStage: "screening", questionCount: 1 });
    return {
        invited_practice_session_id: "session-1",
        recruiter_invitation_recipient_id: "recipient-1",
        batch_lifecycle_state: "ready",
        recipient_lifecycle_state: "ready",
        first_name: "Irma",
        last_name: "Castillo",
        email: "irma@example.invalid",
        requisition_reference: "REQ-1",
        target_role: "Quality Inspector",
        interview_stage: "screening",
        session_status: "in_progress",
        session_attempt_number: 1,
        question_plan_snapshot_json: questionPlanSnapshot,
        question_wording_questions_json: createFixtureCandidateQuestionWordingResult({
            setupSnapshot: {
                targetRole: "Quality Inspector",
                jobDescription: "Inspect finished products.",
                resumeText: null,
                resumeCaptureMode: "none",
                interviewStage: "screening",
                questionCount: 1,
                createdAt: "2026-07-20T00:00:00.000Z",
            },
            questionPlanSnapshot,
        }).questions,
        latest_answers_json: [
            { questionSlotId: "slot-1", questionIndex: 0, answerText: "Latest submitted response." },
        ],
    };
}
