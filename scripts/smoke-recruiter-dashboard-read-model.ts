import { createHash, randomUUID } from "node:crypto";

import { Pool } from "pg";

import { createRecruiterDashboardReadModel } from "../src/features/recruiter-invites-v2/recruiter-dashboard-read-model";
import { createRecruiterDashboardRepository } from "../src/features/recruiter-invites-v2/recruiter-dashboard-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl(),
        max: 1,
        application_name: "interview-coach-recruiter-dashboard-smoke",
    });
    const client = await pool.connect();
    const ownerId = randomUUID();
    const foreignRecruiterId = randomUUID();
    const batchId = randomUUID();
    const recipientId = randomUUID();
    const firstSessionId = randomUUID();
    const latestSessionId = randomUUID();
    const accessTokenId = randomUUID();
    const firstAnswerId = randomUUID();
    const retryAnswerId = randomUUID();
    const privateAnswer = "PRIVATE_ANSWER_MUST_NOT_LEAVE_PERSISTENCE";

    try {
        await client.query("begin");
        await client.query(`
            insert into public.app_users (user_id, email, display_name, status)
            values
              ($1, $3, 'Dashboard owner', 'active'),
              ($2, $4, 'Foreign recruiter', 'active')
        `, [
            ownerId,
            foreignRecruiterId,
            `dashboard-owner-${ownerId}@example.invalid`,
            `dashboard-foreign-${foreignRecruiterId}@example.invalid`,
        ]);
        await client.query(`
            insert into public.app_user_roles (user_id, role)
            values ($1, 'recruiter'), ($2, 'recruiter')
        `, [ownerId, foreignRecruiterId]);

        const plan = {
            interviewStage: "screening",
            questionCount: 3,
            slots: [
                { id: "slot-1", index: 0, category: "screening" },
                { id: "slot-2", index: 1, category: "behavioral" },
                { id: "slot-3", index: 2, category: "culture_fit" },
            ],
        };
        const wording = {
            status: "questions_worded",
            questionCount: 3,
            questions: [
                { slotId: "slot-1", index: 0, questionText: "Question one" },
                { slotId: "slot-2", index: 1, questionText: "Question two" },
                { slotId: "slot-3", index: 2, questionText: "Question three" },
            ],
        };
        const setup = {
            targetRole: "Dashboard smoke role",
            jobDescription: "Dashboard smoke description",
            interviewStage: "screening",
            questionCount: 3,
        };

        await client.query(`
            insert into public.recruiter_invitation_batches (
              recruiter_invitation_batch_id, recruiter_id, lifecycle_state, target_role,
              interview_stage, recipient_count, question_plan_snapshot_json,
              question_wording_snapshot_json
            ) values ($1, $2, 'ready', 'Dashboard smoke role', 'screening', 1, $3::jsonb, $4::jsonb)
        `, [batchId, ownerId, plan, wording]);
        await client.query(`
            insert into public.recruiter_invitation_recipients (
              recruiter_invitation_recipient_id, recruiter_invitation_batch_id, recruiter_id,
              candidate_index, first_name, last_name, email, normalized_email,
              requisition_reference, lifecycle_state
            ) values ($1, $2, $3, 0, 'Dashboard', 'Candidate',
              'dashboard-candidate@example.invalid', 'dashboard-candidate@example.invalid',
              'REQ-DASHBOARD', 'ready')
        `, [recipientId, batchId, ownerId]);
        await client.query(`
            insert into public.invited_practice_sessions (
              invited_practice_session_id, recruiter_invitation_recipient_id, recruiter_id,
              parent_invited_practice_session_id, attempt_number, status,
              setup_snapshot_json, question_plan_snapshot_json,
              question_wording_snapshot_json, progress_state_json
            ) values
              ($1, $3, $4, null, 1, 'abandoned', $5::jsonb, $6::jsonb, $7::jsonb,
                '{"status":"abandoned","currentQuestionIndex":0}'::jsonb),
              ($2, $3, $4, $1, 2, 'in_progress', $5::jsonb, $6::jsonb, $7::jsonb,
                '{"status":"in_progress","currentQuestionIndex":1}'::jsonb)
        `, [firstSessionId, latestSessionId, recipientId, ownerId, setup, plan, wording]);

        await client.query(`
            insert into public.invited_practice_access_tokens (
              invited_practice_access_token_id, invited_practice_session_id,
              recruiter_invitation_recipient_id, token_hash, token_ciphertext,
              encryption_key_id, expires_at
            ) values ($1, $2, $3, $4, 'PRIVATE_TOKEN_CIPHERTEXT', 'smoke-key', now() + interval '1 hour')
        `, [accessTokenId, latestSessionId, recipientId, hash(`access:${randomUUID()}`)]);
        await client.query(`
            insert into public.invited_practice_browser_sessions (
              invited_practice_browser_session_id, invited_practice_access_token_id,
              session_token_hash, expires_at
            ) values ($1, $2, $3, now() + interval '30 minutes')
        `, [randomUUID(), accessTokenId, hash(`browser:${randomUUID()}`)]);
        await client.query(`
            insert into public.invited_practice_entry_signals (
              invited_practice_session_id, recruiter_invitation_recipient_id,
              entered_initials, expected_initials, match_state
            ) values ($1, $2, 'XX', 'DC', 'mismatch')
        `, [latestSessionId, recipientId]);
        await client.query(`
            insert into public.recruiter_invitation_delivery_attempts (
              recruiter_invitation_delivery_attempt_id, recruiter_invitation_batch_id,
              recruiter_invitation_recipient_id, recruiter_id, attempt_number,
              action_key_hash, channel, provider, lifecycle_state, failure_code,
              retryable, completed_at
            ) values ($1, $2, $3, $4, 1, $5, 'email', 'fixture', 'failed',
              'provider_unavailable', true, now())
        `, [randomUUID(), batchId, recipientId, ownerId, hash(`delivery:${randomUUID()}`)]);
        await client.query(`
            insert into public.invited_practice_answer_attempts (
              invited_practice_answer_attempt_id, invited_practice_session_id,
              recruiter_invitation_recipient_id, question_slot_id, question_index,
              attempt_number, trigger, supersedes_invited_practice_answer_attempt_id,
              mode, answer_text, submitted_at, idempotency_key, payload_fingerprint
            ) values
              ($1, $4, $5, 'slot-1', 0, 1, 'initial_submit', null,
                'text', $6, now() - interval '2 minutes', $7, 'fingerprint-1'),
              ($2, $4, $5, 'slot-1', 0, 2, 'feedback_retry', $1,
                'text', 'PRIVATE_RETRY_MUST_NOT_LEAVE_PERSISTENCE', now() - interval '1 minute', $8, 'fingerprint-2'),
              ($3, $4, $5, 'slot-2', 1, 1, 'initial_submit', null,
                'text', 'PRIVATE_SECOND_ANSWER_MUST_NOT_LEAVE_PERSISTENCE', now(), $9, 'fingerprint-3')
        `, [
            firstAnswerId,
            retryAnswerId,
            randomUUID(),
            latestSessionId,
            recipientId,
            privateAnswer,
            `answer:${randomUUID()}`,
            `retry:${randomUUID()}`,
            `answer:${randomUUID()}`,
        ]);

        const repository = createRecruiterDashboardRepository({
            query: (sql, values) => client.query(sql, values),
        });
        const ownerFacts = await repository.listOwnedRecipientFacts(ownerId);
        const foreignFacts = await repository.listOwnedRecipientFacts(foreignRecruiterId);
        assert(ownerFacts.length === 1, "The owning recruiter did not receive exactly one recipient.");
        assert(foreignFacts.length === 0, "A foreign recruiter read another recruiter's recipient.");
        assert(ownerFacts[0]?.sessionId === latestSessionId, "The dashboard did not select the newest session attempt.");
        assert(ownerFacts[0]?.sessionAttemptNumber === 2, "The dashboard lost session-attempt lineage.");
        assert(ownerFacts[0]?.answeredQuestionCount === 2, "Answer retries inflated distinct-question progress.");

        const model = createRecruiterDashboardReadModel(ownerFacts);
        assert(model.recipients[0]?.deliveryState === "failed_retryable", "Retryable delivery failure was misclassified.");
        assert(model.recipients[0]?.entryState === "initials_mismatch", "Initials mismatch was not preserved as a signal.");
        assert(model.recipients[0]?.practiceState === "in_progress", "Latest practice status was misclassified.");
        assert(model.summary.needsAttention === 1, "Attention summary did not count the recipient once.");

        const serialized = JSON.stringify({ ownerFacts, model });
        for (const forbidden of [
            "PRIVATE_ANSWER",
            "PRIVATE_RETRY",
            "PRIVATE_SECOND_ANSWER",
            "PRIVATE_TOKEN_CIPHERTEXT",
            "answerText",
            "tokenHash",
            "providerReferenceId",
            "configurationManifest",
            "resultJson",
        ]) {
            assert(!serialized.includes(forbidden), `Dashboard projection leaked forbidden material: ${forbidden}.`);
        }

        console.log("Recruiter dashboard read-model smoke passed.");
    } finally {
        await client.query("rollback").catch(() => undefined);
        client.release();
        await pool.end();
    }
}

function hash(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
