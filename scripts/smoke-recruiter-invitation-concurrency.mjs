#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";

import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const databaseUrl = process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl();
const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
    max: 8,
    application_name: "interview-coach-recruiter-invitation-concurrency-smoke",
});
const recruiterId = randomUUID();
const idempotencyKeyHash = "7".repeat(64);
const requestFingerprint = "8".repeat(64);
let persistedBatchId;

const plan = {
    interviewStage: "screening",
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
        category: "screening",
        label: "Screening",
        purpose: "Basic fit.",
    }],
};
const wording = {
    status: "questions_worded",
    questions: [{
        slotId: "slot-1",
        index: 0,
        category: "screening",
        questionText: "Why does this role interest you?",
    }],
};

try {
    await pool.query(`
        insert into public.app_users (user_id, email, display_name, status)
        values ($1, $2, 'Invite Concurrency Smoke', 'active')
    `, [recruiterId, `invite-concurrency-${recruiterId}@example.invalid`]);
    await pool.query(`
        insert into public.app_user_roles (user_id, role)
        values ($1, 'recruiter')
    `, [recruiterId]);

    const requests = await Promise.all(Array.from({ length: 8 }, (_, index) => {
        const batchId = randomUUID();
        const recipientId = randomUUID();
        const sessionId = randomUUID();
        const tokenHash = createHash("sha256").update(`concurrency-token-${index}`).digest("hex");
        const recipients = [{
            candidateIndex: 0,
            recipientId,
            sessionId,
            firstName: "Concurrent",
            lastName: "Candidate",
            email: "concurrent.candidate@example.invalid",
            requisitionReference: null,
            resumeText: null,
            tokenHash,
            tokenCiphertext: `v1.smoke.iv.tag.ciphertext-${index}`,
            encryptionKeyId: "smoke-key",
            tokenExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        }];
        return pool.query(`
            select *
            from public.create_recruiter_invitation_aggregate(
              $1::uuid, $2::text, $3::text, $4::uuid, $5::text,
              $6::text, $7::text, $8::jsonb, $9::jsonb, $10::jsonb
            )
        `, [
            recruiterId,
            idempotencyKeyHash,
            requestFingerprint,
            batchId,
            "Concurrency Inspector",
            "Inspect safely.",
            "screening",
            JSON.stringify(plan),
            JSON.stringify(wording),
            JSON.stringify(recipients),
        ]);
    }));
    const rows = requests.map((result) => result.rows[0]);
    const batchIds = new Set(rows.map((row) => row.recruiter_invitation_batch_id));
    persistedBatchId = rows[0].recruiter_invitation_batch_id;

    assert.equal(rows.filter((row) => row.creation_outcome === "created").length, 1);
    assert.equal(rows.filter((row) => row.creation_outcome === "replayed").length, 7);
    assert.equal(batchIds.size, 1);

    const persisted = await pool.query(`
        select
          (select count(*)::integer from public.recruiter_invitation_batches where recruiter_id = $1) as batch_count,
          (select count(*)::integer from public.recruiter_invitation_recipients where recruiter_id = $1) as recipient_count,
          (select count(*)::integer from public.invited_practice_sessions where recruiter_id = $1) as session_count,
          (select count(*)::integer from public.recruiter_invitation_creation_requests where recruiter_id = $1) as request_count,
          (
            select count(*)::integer
            from public.invited_practice_access_tokens token
            join public.invited_practice_sessions session
              on session.invited_practice_session_id = token.invited_practice_session_id
            where session.recruiter_id = $1
          ) as token_count
    `, [recruiterId]);
    assert.deepEqual(persisted.rows[0], {
        batch_count: 1,
        recipient_count: 1,
        session_count: 1,
        request_count: 1,
        token_count: 1,
    });

    console.log("Recruiter invitation concurrency smoke passed: 1 created, 7 replayed, 1 complete aggregate.");
} finally {
    if (persistedBatchId) {
        await pool.query(
            "delete from public.recruiter_invitation_batches where recruiter_invitation_batch_id = $1",
            [persistedBatchId],
        ).catch(() => undefined);
    }
    await pool.query("delete from public.app_users where user_id = $1", [recruiterId]).catch(() => undefined);
    await pool.end();
}
