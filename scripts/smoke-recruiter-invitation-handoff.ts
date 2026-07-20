import { createHash, randomUUID } from "node:crypto";

import { Pool } from "pg";

import type { InvitedPracticeTokenVault } from "../src/features/recruiter-invites-v2/invited-practice-token-vault";
import { createRecruiterInvitationHandoffReadModel } from "../src/features/recruiter-invites-v2/recruiter-invitation-handoff-read-model";
import { createRecruiterInvitationHandoffRepository } from "../src/features/recruiter-invites-v2/recruiter-invitation-handoff-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl(),
        max: 1,
        application_name: "interview-coach-recruiter-handoff-smoke",
    });
    const client = await pool.connect();
    const ownerId = randomUUID();
    const foreignRecruiterId = randomUUID();
    const batchId = randomUUID();
    const acceptedRecipientId = randomUUID();
    const retryRecipientId = randomUUID();
    const acceptedSessionId = randomUUID();
    const retrySessionId = randomUUID();
    const oldAttemptId = randomUUID();
    const latestAttemptId = randomUUID();
    const staleQueuedAttemptId = randomUUID();

    try {
        await client.query("begin");
        await client.query(`
            insert into public.app_users (user_id, email, display_name, status)
            values
              ($1, $3, 'Handoff owner', 'active'),
              ($2, $4, 'Foreign recruiter', 'active')
        `, [
            ownerId,
            foreignRecruiterId,
            `handoff-owner-${ownerId}@example.invalid`,
            `handoff-foreign-${foreignRecruiterId}@example.invalid`,
        ]);
        await client.query(`
            insert into public.app_user_roles (user_id, role)
            values ($1, 'recruiter'), ($2, 'recruiter')
        `, [ownerId, foreignRecruiterId]);

        const plan = { interviewStage: "screening", questionCount: 1, slots: [{ id: "slot-1", index: 0, category: "screening" }] };
        const wording = { status: "questions_worded", questions: [{ slotId: "slot-1", index: 0, category: "screening", questionText: "Why are you interested?" }] };
        const setup = { targetRole: "Handoff smoke role", interviewStage: "screening", questionCount: 1 };

        await client.query(`
            insert into public.recruiter_invitation_batches (
              recruiter_invitation_batch_id, recruiter_id, lifecycle_state, target_role,
              interview_stage, recipient_count, question_plan_snapshot_json,
              question_wording_snapshot_json
            ) values ($1, $2, 'ready', 'Handoff smoke role', 'screening', 2, $3::jsonb, $4::jsonb)
        `, [batchId, ownerId, plan, wording]);
        await client.query(`
            insert into public.recruiter_invitation_recipients (
              recruiter_invitation_recipient_id, recruiter_invitation_batch_id, recruiter_id,
              candidate_index, first_name, last_name, email, normalized_email, lifecycle_state
            ) values
              ($1, $3, $4, 0, 'Accepted', 'Candidate', 'accepted@example.invalid', 'accepted@example.invalid', 'ready'),
              ($2, $3, $4, 1, 'Retry', 'Candidate', 'retry@example.invalid', 'retry@example.invalid', 'ready')
        `, [acceptedRecipientId, retryRecipientId, batchId, ownerId]);
        await client.query(`
            insert into public.invited_practice_sessions (
              invited_practice_session_id, recruiter_invitation_recipient_id, recruiter_id,
              attempt_number, status, setup_snapshot_json, question_plan_snapshot_json,
              question_wording_snapshot_json, progress_state_json
            ) values
              ($1, $3, $5, 1, 'planned', $6::jsonb, $7::jsonb, $8::jsonb, '{"status":"planned","currentQuestionIndex":0}'::jsonb),
              ($2, $4, $5, 1, 'in_progress', $6::jsonb, $7::jsonb, $8::jsonb, '{"status":"in_progress","currentQuestionIndex":0}'::jsonb)
        `, [acceptedSessionId, retrySessionId, acceptedRecipientId, retryRecipientId, ownerId, setup, plan, wording]);
        await client.query(`
            insert into public.invited_practice_access_tokens (
              invited_practice_session_id, recruiter_invitation_recipient_id, token_hash,
              token_ciphertext, encryption_key_id, expires_at
            ) values
              ($1, $3, $5, $7, 'smoke-key', now() + interval '1 day'),
              ($2, $4, $6, $8, 'smoke-key', now() + interval '1 day')
        `, [
            acceptedSessionId,
            retrySessionId,
            acceptedRecipientId,
            retryRecipientId,
            hash(`accepted:${randomUUID()}`),
            hash(`retry:${randomUUID()}`),
            `cipher:${acceptedRecipientId}`,
            `cipher:${retryRecipientId}`,
        ]);
        await client.query(`
            insert into public.recruiter_invitation_delivery_attempts (
              recruiter_invitation_delivery_attempt_id, recruiter_invitation_batch_id,
              recruiter_invitation_recipient_id, recruiter_id, retry_of_delivery_attempt_id,
              attempt_number, action_key_hash, channel, provider, lifecycle_state,
              provider_reference_id, failure_code, retryable, queued_at, started_at,
              completed_at, created_at, updated_at
            ) values
              ($1, $4, $5, $6, null, 1, $7, 'email', 'fixture', 'failed', null,
                'provider_unavailable', true, now() - interval '20 minutes', null,
                now() - interval '19 minutes', now() - interval '20 minutes', now() - interval '19 minutes'),
              ($2, $4, $5, $6, $1, 2, $8, 'email', 'fixture', 'provider_accepted',
                'provider-accepted', null, false, now() - interval '10 minutes', now() - interval '9 minutes',
                now() - interval '8 minutes', now() - interval '10 minutes', now() - interval '8 minutes'),
              ($3, $4, $9, $6, null, 1, $10, 'email', 'fixture', 'queued', null,
                null, false, now() - interval '6 minutes', null, null,
                now() - interval '6 minutes', now() - interval '6 minutes')
        `, [
            oldAttemptId,
            latestAttemptId,
            staleQueuedAttemptId,
            batchId,
            acceptedRecipientId,
            ownerId,
            hash(`old:${randomUUID()}`),
            hash(`accepted:${randomUUID()}`),
            retryRecipientId,
            hash(`queued:${randomUUID()}`),
        ]);

        const repository = createRecruiterInvitationHandoffRepository({
            query: (sql, values) => client.query(sql, values),
        });
        const ownerFact = await repository.findOwnedHandoffFact(ownerId, batchId);
        const foreignFact = await repository.findOwnedHandoffFact(foreignRecruiterId, batchId);
        assert(ownerFact, "The owning recruiter could not recover the invitation handoff.");
        assert(foreignFact === null, "A foreign recruiter recovered another recruiter's invitation handoff.");
        assert(ownerFact.recipients[0]?.delivery?.attemptId === latestAttemptId, "The handoff did not select the latest delivery attempt.");

        const model = createRecruiterInvitationHandoffReadModel(ownerFact, {
            appOrigin: "https://interviewcoach.example",
            recruiterName: "Handoff owner",
            tokenVault: smokeTokenVault(),
        });
        assert(model.recipients[0]?.deliveryState === "provider_accepted", "Provider acceptance was not preserved as terminal.");
        assert(model.recipients[0]?.actionEligibility === null, "An accepted recipient became retryable.");
        assert(model.recipients[1]?.deliveryState === "failed_retryable", "A stale queued claim was not recognized as safely retryable.");
        assert(model.recipients[1]?.actionEligibility === "retry", "A stale queued claim did not expose the bounded retry action.");
        assert(model.recipients.every((recipient) => recipient.inviteLink?.startsWith("https://interviewcoach.example/s/smoke-token-") === true), "Active links were not reconstructed inside the owned detail.");

        const serialized = JSON.stringify(model);
        for (const forbidden of ["cipher:", "provider-accepted", "provider_reference_id", "tokenCiphertext", "encryptionKeyId"]) {
            assert(!serialized.includes(forbidden), `Handoff browser model leaked private server material: ${forbidden}.`);
        }

        console.log("Recruiter invitation handoff smoke passed.");
    } finally {
        await client.query("rollback").catch(() => undefined);
        client.release();
        await pool.end();
    }
}

function smokeTokenVault(): InvitedPracticeTokenVault {
    return {
        createTokenMaterial() {
            throw new Error("Token creation is not part of the handoff smoke.");
        },
        decryptToken({ tokenCiphertext }) {
            return `smoke-token-${tokenCiphertext.slice("cipher:".length)}`;
        },
    };
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
