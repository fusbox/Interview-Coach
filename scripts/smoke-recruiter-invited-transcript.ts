import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { createCandidateQuestionPlan } from "../src/features/candidate-session-v2/candidate-question-plan";
import { createFixtureCandidateQuestionWordingResult } from "../src/features/candidate-session-v2/candidate-question-wording";
import { createRecruiterInvitedTranscriptReadModel } from "../src/features/recruiter-invites-v2/recruiter-invited-transcript-read-model";
import { createRecruiterInvitedTranscriptRepository } from "../src/features/recruiter-invites-v2/recruiter-invited-transcript-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl(),
        max: 1,
        application_name: "interview-coach-recruiter-transcript-smoke",
    });
    const client = await pool.connect();
    const ownerId = randomUUID();
    const foreignRecruiterId = randomUUID();
    const batchId = randomUUID();
    const recipientId = randomUUID();
    const sessionId = randomUUID();
    const firstAnswerId = randomUUID();
    const latestAnswerId = randomUUID();
    const oldAnswerText = "PRIVATE_SUPERSEDED_ANSWER";
    const latestAnswerText = "I inspect the item, document the defect, and isolate it before release.";
    const draftText = "PRIVATE_UNSUBMITTED_DRAFT";
    const coachingText = "PRIVATE_CANDIDATE_COACHING";

    try {
        await client.query("begin");
        await client.query(`
            insert into public.app_users (user_id, email, display_name, status)
            values
              ($1, $3, 'Transcript owner', 'active'),
              ($2, $4, 'Foreign recruiter', 'active')
        `, [
            ownerId,
            foreignRecruiterId,
            `transcript-owner-${ownerId}@example.invalid`,
            `transcript-foreign-${foreignRecruiterId}@example.invalid`,
        ]);
        await client.query(`
            insert into public.app_user_roles (user_id, role)
            values ($1, 'recruiter'), ($2, 'recruiter')
        `, [ownerId, foreignRecruiterId]);

        const questionPlan = createCandidateQuestionPlan({ interviewStage: "screening", questionCount: 3 });
        const setupSnapshot = {
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished products and document quality findings.",
            resumeText: null,
            resumeCaptureMode: "none" as const,
            interviewStage: "screening" as const,
            questionCount: 3,
            createdAt: "2026-07-20T00:00:00.000Z",
        };
        const wording = createFixtureCandidateQuestionWordingResult({ setupSnapshot, questionPlanSnapshot: questionPlan });

        await client.query(`
            insert into public.recruiter_invitation_batches (
              recruiter_invitation_batch_id, recruiter_id, lifecycle_state, target_role,
              interview_stage, recipient_count, question_plan_snapshot_json,
              question_wording_snapshot_json
            ) values ($1, $2, 'ready', 'Quality Inspector', 'screening', 1, $3::jsonb, $4::jsonb)
        `, [batchId, ownerId, questionPlan, wording]);
        await client.query(`
            insert into public.recruiter_invitation_recipients (
              recruiter_invitation_recipient_id, recruiter_invitation_batch_id, recruiter_id,
              candidate_index, first_name, last_name, email, normalized_email,
              requisition_reference, lifecycle_state
            ) values ($1, $2, $3, 0, 'Transcript', 'Candidate',
              'transcript-candidate@example.invalid', 'transcript-candidate@example.invalid',
              'REQ-TRANSCRIPT', 'ready')
        `, [recipientId, batchId, ownerId]);
        await client.query(`
            insert into public.invited_practice_sessions (
              invited_practice_session_id, recruiter_invitation_recipient_id, recruiter_id,
              attempt_number, status, setup_snapshot_json, question_plan_snapshot_json,
              question_wording_snapshot_json, progress_state_json, answer_drafts_json,
              answer_analysis_snapshots_json
            ) values (
              $1, $2, $3, 1, 'in_progress', $4::jsonb, $5::jsonb, $6::jsonb,
              '{"status":"live_question","currentQuestionIndex":2}'::jsonb,
              jsonb_build_object('slot-3', jsonb_build_object('text', $7::text)),
              jsonb_build_object('slot-1', jsonb_build_object('coachFeedback', $8::text))
            )
        `, [sessionId, recipientId, ownerId, setupSnapshot, questionPlan, wording, draftText, coachingText]);
        await client.query(`
            insert into public.invited_practice_answer_attempts (
              invited_practice_answer_attempt_id, invited_practice_session_id,
              recruiter_invitation_recipient_id, question_slot_id, question_index,
              attempt_number, trigger, supersedes_invited_practice_answer_attempt_id,
              mode, answer_text, submitted_at, idempotency_key, payload_fingerprint
            ) values
              ($1, $4, $5, 'slot-1', 0, 1, 'initial_submit', null,
                'text', $6, now() - interval '2 minutes', $8, 'fingerprint-1'),
              ($2, $4, $5, 'slot-1', 0, 2, 'feedback_retry', $1,
                'text', $7, now() - interval '1 minute', $9, 'fingerprint-2'),
              ($3, $4, $5, 'slot-2', 1, 1, 'initial_submit', null,
                'text', 'I compare the record with the approved standard.', now(), $10, 'fingerprint-3')
        `, [
            firstAnswerId,
            latestAnswerId,
            randomUUID(),
            sessionId,
            recipientId,
            oldAnswerText,
            latestAnswerText,
            `answer:${randomUUID()}`,
            `retry:${randomUUID()}`,
            `answer:${randomUUID()}`,
        ]);

        const repository = createRecruiterInvitedTranscriptRepository({
            query: (sql, values) => client.query(sql, values),
        });
        const ownerFact = await repository.findOwnedTranscriptFact(ownerId, sessionId);
        const foreignFact = await repository.findOwnedTranscriptFact(foreignRecruiterId, sessionId);
        assert(ownerFact, "The owning recruiter could not read the invited transcript.");
        assert(foreignFact === null, "A foreign recruiter read another recruiter's invited transcript.");

        const model = createRecruiterInvitedTranscriptReadModel(ownerFact);
        assert(model.answeredQuestionCount === 2, "The transcript did not count distinct answered questions.");
        assert(model.items[0]?.answerText === latestAnswerText, "The transcript did not select the latest immutable answer attempt.");
        assert(model.items[1]?.answerText !== null, "The second submitted answer was not visible.");
        assert(model.items[2]?.answerText === null, "An unsubmitted draft was presented as a submitted response.");

        const serialized = JSON.stringify({ ownerFact, model });
        for (const forbidden of [oldAnswerText, draftText, coachingText, "answerAnalysis", "feedbackActions", "engagement"]) {
            assert(!serialized.includes(forbidden), `Recruiter transcript leaked forbidden material: ${forbidden}.`);
        }

        console.log("Recruiter invited transcript smoke passed.");
    } finally {
        await client.query("rollback").catch(() => undefined);
        client.release();
        await pool.end();
    }
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
