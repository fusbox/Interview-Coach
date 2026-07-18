#!/usr/bin/env node
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const databaseUrl = process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl();
const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
    max: 8,
    application_name: "interview-coach-direct-intent-concurrency-smoke",
});
const candidateProfileId = randomUUID();
const roleProfileId = randomUUID();
const idempotencyKeyHash = "1".repeat(64);
const requestFingerprint = "2".repeat(64);

try {
    await pool.query(`
        insert into public.candidate_profiles (
          candidate_profile_id, auth_subject, email, display_name, workspace
        ) values ($1, $2, $3, 'Concurrency Smoke', 'local_dev')
    `, [
        candidateProfileId,
        `local_dev:direct-intent-concurrency:${candidateProfileId}`,
        `direct-intent-concurrency-${candidateProfileId}@example.invalid`,
    ]);
    await pool.query(`
        insert into public.candidate_role_preparation_profiles (
          role_profile_id, candidate_profile_id, target_role, normalized_target_role,
          job_description_snapshot, job_description_hash, source
        ) values ($1, $2, 'Concurrency Inspector', 'concurrency inspector', 'Inspect safely.', $3, 'manual')
    `, [roleProfileId, candidateProfileId, `direct-intent-concurrency-${candidateProfileId}`]);

    const values = [
        candidateProfileId,
        idempotencyKeyHash,
        requestFingerprint,
        "coach_update_detail",
        roleProfileId,
        "concurrency inspector",
        "Concurrency Inspector",
        JSON.stringify({
            targetRole: "Concurrency Inspector",
            jobDescription: "Inspect safely.",
            interviewStage: "screening",
            questionCount: 1,
            resumeIncluded: false,
        }),
        JSON.stringify([{
            kind: "practice_from_feedback",
            source: {
                kind: "coach_update_detail",
                candidatePracticeSessionId: "source-session-concurrency",
                questionKey: "slot-1",
                targetInterviewId: "concurrency inspector",
                targetRole: "Concurrency Inspector",
                questionNumber: 1,
                category: "Screening",
                questionText: "Why does this role interest you?",
                evidenceStatus: "practiced_with_coaching",
            },
            display: {
                label: "Practice from coach feedback",
                body: "Practice one answer.",
            },
        }]),
    ];
    const requests = await Promise.all(Array.from({ length: 8 }, () => pool.query(`
        select *
        from public.create_candidate_direct_practice_intent(
          $1::uuid, $2::text, $3::text, $4::text, $5::uuid,
          $6::text, $7::text, $8::jsonb, $9::jsonb
        )
    `, values)));
    const rows = requests.map((result) => result.rows[0]);
    const intentIds = new Set(rows.map((row) => row.candidate_practice_intent_id));

    assert.equal(rows.filter((row) => row.creation_outcome === "created").length, 1);
    assert.equal(rows.filter((row) => row.creation_outcome === "replayed").length, 7);
    assert.equal(intentIds.size, 1);

    const persisted = await pool.query(`
        select
          (select count(*)::integer from public.candidate_practice_intents where candidate_profile_id = $1) as intent_count,
          (select count(*)::integer from public.candidate_practice_intent_creation_requests where candidate_profile_id = $1) as request_count
    `, [candidateProfileId]);
    assert.deepEqual(persisted.rows[0], { intent_count: 1, request_count: 1 });
    console.log("Candidate direct-intent concurrency smoke passed: 1 created, 7 replayed, 1 intent.");
} finally {
    await pool.query(
        "delete from public.candidate_profiles where candidate_profile_id = $1",
        [candidateProfileId],
    ).catch(() => undefined);
    await pool.end();
}
