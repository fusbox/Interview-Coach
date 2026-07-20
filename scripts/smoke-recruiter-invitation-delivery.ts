import { createHash, randomUUID } from "node:crypto";

import { Pool } from "pg";

import { createRecruiterInvitationDeliveryRepository } from "../src/features/recruiter-invites-v2/recruiter-invitation-delivery-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const RECRUITER_ID = "20000000-0000-4000-8000-000000000001";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl(),
        max: 10,
        application_name: "interview-coach-recruiter-delivery-smoke",
    });
    const batchId = randomUUID();
    const recipientId = randomUUID();
    const staleRecipientId = randomUUID();
    const staleAttemptId = randomUUID();
    const actionKeyHash = hash(`delivery-smoke:${randomUUID()}`);
    const repositories = Array.from({ length: 8 }, () => createRecruiterInvitationDeliveryRepository({
        query: (sql, values) => pool.query(sql, values),
    }));

    try {
        await pool.query(`
            insert into public.recruiter_invitation_batches (
              recruiter_invitation_batch_id, recruiter_id, lifecycle_state, target_role,
              interview_stage, recipient_count, question_plan_snapshot_json, question_wording_snapshot_json
            ) values ($1, $2, 'ready', 'Delivery smoke', 'screening', 2, '{}'::jsonb, '{}'::jsonb)
        `, [batchId, RECRUITER_ID]);
        await pool.query(`
            insert into public.recruiter_invitation_recipients (
              recruiter_invitation_recipient_id, recruiter_invitation_batch_id, recruiter_id,
              candidate_index, first_name, last_name, email, normalized_email, lifecycle_state
            ) values ($1, $2, $3, 0, 'Delivery', 'Smoke', 'delivery@example.invalid', 'delivery@example.invalid', 'ready')
        `, [recipientId, batchId, RECRUITER_ID]);
        await pool.query(`
            insert into public.recruiter_invitation_recipients (
              recruiter_invitation_recipient_id, recruiter_invitation_batch_id, recruiter_id,
              candidate_index, first_name, last_name, email, normalized_email, lifecycle_state
            ) values ($1, $2, $3, 1, 'Stale', 'Claim', 'stale@example.invalid', 'stale@example.invalid', 'ready')
        `, [staleRecipientId, batchId, RECRUITER_ID]);

        const claims = await Promise.all(repositories.map((repository) => repository.claim({
            recruiterId: RECRUITER_ID,
            batchId,
            recipientId,
            attemptId: randomUUID(),
            actionKeyHash,
            provider: "fixture",
        })));
        assert(claims.filter((claim) => claim.outcome === "claimed").length === 1, "Expected one delivery claim winner.");
        assert(claims.filter((claim) => claim.outcome === "replayed").length === 7, "Exact concurrent delivery claims did not replay.");

        const winner = claims.find((claim) => claim.outcome === "claimed")?.attempt;
        assert(winner, "Delivery claim winner was missing its attempt.");
        const started = await repositories[0].start({ recruiterId: RECRUITER_ID, attemptId: winner.attemptId });
        assert(started?.lifecycleState === "sending", "Queued delivery did not enter sending.");
        assert(await repositories[0].accept({
            recruiterId: RECRUITER_ID,
            attemptId: winner.attemptId,
            providerReferenceId: "fixture-provider-reference",
        }), "Sending delivery did not record provider acceptance.");

        const afterAcceptance = await repositories[1].claim({
            recruiterId: RECRUITER_ID,
            batchId,
            recipientId,
            attemptId: randomUUID(),
            actionKeyHash: hash(`delivery-smoke-later:${randomUUID()}`),
            provider: "fixture",
        });
        assert(afterAcceptance.outcome === "already_accepted", "Accepted recipient was eligible for another send.");

        await pool.query(`
            insert into public.recruiter_invitation_delivery_attempts (
              recruiter_invitation_delivery_attempt_id, recruiter_invitation_batch_id,
              recruiter_invitation_recipient_id, recruiter_id, attempt_number, action_key_hash,
              channel, provider, lifecycle_state, queued_at, created_at, updated_at
            ) values ($1, $2, $3, $4, 1, $5, 'email', 'fixture', 'queued',
              now() - interval '6 minutes', now() - interval '6 minutes', now() - interval '6 minutes')
        `, [staleAttemptId, batchId, staleRecipientId, RECRUITER_ID, hash(`stale-claim:${randomUUID()}`)]);
        const reclaimed = await repositories[2].claim({
            recruiterId: RECRUITER_ID,
            batchId,
            recipientId: staleRecipientId,
            attemptId: randomUUID(),
            actionKeyHash: hash(`replacement-claim:${randomUUID()}`),
            provider: "fixture",
        });
        assert(reclaimed.outcome === "claimed", "Expired queued claim did not append a safe retry attempt.");
        assert(reclaimed.attempt?.attemptNumber === 2, "Expired queued claim did not preserve attempt lineage.");
        const staleState = await pool.query(`
            select lifecycle_state, failure_code, retryable
            from public.recruiter_invitation_delivery_attempts
            where recruiter_invitation_delivery_attempt_id = $1
        `, [staleAttemptId]);
        assert(staleState.rows[0]?.lifecycle_state === "failed", "Expired queued claim was not retired as failed.");
        assert(staleState.rows[0]?.failure_code === "queued_claim_expired", "Expired queued claim lost its safe classification.");
        assert(staleState.rows[0]?.retryable === true, "Expired queued claim was not marked retryable.");

        let immutable = false;
        try {
            await pool.query(`
                update public.recruiter_invitation_delivery_attempts
                set lifecycle_state = 'failed', failure_code = 'mutated', completed_at = now()
                where recruiter_invitation_delivery_attempt_id = $1
            `, [winner.attemptId]);
        } catch (error) {
            immutable = readPostgresCode(error) === "55000";
        }
        assert(immutable, "Provider-accepted delivery attempt was mutable.");

        console.log("Recruiter invitation delivery smoke passed.");
    } finally {
        await pool.query(`
            delete from public.recruiter_invitation_batches
            where recruiter_invitation_batch_id = $1 and recruiter_id = $2
        `, [batchId, RECRUITER_ID]).catch(() => undefined);
        await pool.end();
    }
}

function hash(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function readPostgresCode(error: unknown) {
    if (!error || typeof error !== "object" || !("code" in error)) return null;
    return typeof error.code === "string" ? error.code : null;
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
