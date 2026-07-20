import { createHash, randomUUID } from "node:crypto";

import { Pool } from "pg";

import { createInvitedPracticeAccessRepository } from "../src/features/recruiter-invites-v2/invited-practice-access-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const RECRUITER_ID = "20000000-0000-4000-8000-000000000001";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl(),
        max: 12,
        application_name: "interview-coach-invited-repeat-smoke",
    });
    const batchId = randomUUID();
    const recipientId = randomUUID();
    const parentSessionId = randomUUID();
    const accessTokenId = randomUUID();
    const sourceBrowserSessionId = randomUUID();
    const invitationTokenHash = hash("invitation-token");
    const sourceBrowserTokenHash = hash("source-browser-token");

    try {
        await createFixture(pool, {
            batchId,
            recipientId,
            parentSessionId,
            accessTokenId,
            sourceBrowserSessionId,
            invitationTokenHash,
            sourceBrowserTokenHash,
        });

        const requestedExpiresAt = new Date(Date.now() + 60 * 60 * 1_000).toISOString();
        const results = await Promise.all(Array.from({ length: 8 }, (_, index) => pool.query(`
            select *
            from public.advance_invited_practice_attempt($1, $2, $3, $4, $5, $6)
        `, [
            sourceBrowserTokenHash,
            parentSessionId,
            randomUUID(),
            randomUUID(),
            hash(`rotated-browser-${index}`),
            requestedExpiresAt,
        ])));

        const outcomes = results.map((result) => result.rows[0]?.outcome);
        assert(outcomes.filter((value) => value === "created").length === 1, "Concurrent repeat did not create exactly one child.");
        assert(outcomes.filter((value) => value === "replayed").length === 7, "Concurrent repeat did not replay the winning child.");
        const childIds = new Set(results.map((result) => result.rows[0]?.invited_practice_session_id));
        assert(childIds.size === 1 && !childIds.has(undefined), "Concurrent repeat did not converge on one child id.");
        const childSessionId = String(results[0].rows[0].invited_practice_session_id);

        const lineage = await pool.query(`
            select invited_practice_session_id, parent_invited_practice_session_id, attempt_number,
                   status, setup_snapshot_json, question_plan_snapshot_json, question_wording_snapshot_json,
                   completion_snapshot_json
            from public.invited_practice_sessions
            where recruiter_invitation_recipient_id = $1
            order by attempt_number
        `, [recipientId]);
        assert(lineage.rows.length === 2, "Repeat created an unexpected number of session attempts.");
        assert(lineage.rows[0].status === "completed" && lineage.rows[0].completion_snapshot_json, "Parent completion was mutated.");
        assert(lineage.rows[1].attempt_number === 2 && lineage.rows[1].status === "planned", "Child attempt state is invalid.");
        assert(lineage.rows[1].parent_invited_practice_session_id === parentSessionId, "Child lineage does not point to the completed parent.");
        for (const field of ["setup_snapshot_json", "question_plan_snapshot_json", "question_wording_snapshot_json"] as const) {
            assert(JSON.stringify(lineage.rows[0][field]) === JSON.stringify(lineage.rows[1][field]), `${field} changed across repeat.`);
        }

        const parentAnswers = await pool.query(`
            select count(*)::integer as count
            from public.invited_practice_answer_attempts
            where invited_practice_session_id = $1
        `, [parentSessionId]);
        const childAnswers = await pool.query(`
            select count(*)::integer as count
            from public.invited_practice_answer_attempts
            where invited_practice_session_id = $1
        `, [childSessionId]);
        assert(parentAnswers.rows[0].count === 1 && childAnswers.rows[0].count === 0, "Repeat moved or copied answer history.");

        const repository = createInvitedPracticeAccessRepository({
            query: (sql, values) => pool.query(sql, values),
        });
        const exchange = await repository.exchangeInvitationToken({
            invitationTokenHash,
            browserSessionId: randomUUID(),
            browserSessionTokenHash: hash("original-link-reopen"),
            requestedExpiresAt,
        });
        assert(exchange?.sessionId === childSessionId, "Original invitation did not resolve the latest attempt.");
        assert(exchange?.sessionAttemptNumber === 2, "Original invitation returned the wrong attempt number.");
        assert(exchange?.entrySignal?.matchState === "match", "Initial invite-entry signal was not preserved across attempts.");

        const stale = await pool.query(`
            select *
            from public.advance_invited_practice_attempt($1, $2, $3, $4, $5, $6)
        `, [
            sourceBrowserTokenHash,
            randomUUID(),
            randomUUID(),
            randomUUID(),
            hash("stale-parent-browser"),
            requestedExpiresAt,
        ]);
        assert(stale.rows[0]?.outcome === "stale_parent", "A stale ancestor did not fail closed.");

        console.log("Invited practice completion and repeat smoke passed.");
    } finally {
        await pool.query(`
            delete from public.recruiter_invitation_batches
            where recruiter_invitation_batch_id = $1 and recruiter_id = $2
        `, [batchId, RECRUITER_ID]).catch(() => undefined);
        await pool.end();
    }
}

async function createFixture(pool: Pool, ids: {
    batchId: string;
    recipientId: string;
    parentSessionId: string;
    accessTokenId: string;
    sourceBrowserSessionId: string;
    invitationTokenHash: string;
    sourceBrowserTokenHash: string;
}) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1_000);
    const plan = {
        interviewStage: "screening",
        questionCount: 1,
        categoryCounts: { screening: 1 },
        slots: [{ id: "slot-1", index: 0, category: "screening", label: "Screening" }],
    };
    const wording = {
        status: "questions_worded",
        questionCount: 1,
        questions: [{ slotId: "slot-1", index: 0, category: "screening", questionText: "Why are you interested in this role?" }],
        generatedAt: now.toISOString(),
    };
    const setup = {
        targetRole: "Invited repeat smoke",
        jobDescription: "Inspect finished goods.",
        resumeText: null,
        interviewStage: "screening",
        questionCount: 1,
        resumeCaptureMode: "none",
        createdAt: now.toISOString(),
    };
    await pool.query(`
        insert into public.recruiter_invitation_batches (
          recruiter_invitation_batch_id, recruiter_id, lifecycle_state, target_role,
          interview_stage, recipient_count, question_plan_snapshot_json, question_wording_snapshot_json
        ) values ($1, $2, 'ready', 'Invited repeat smoke', 'screening', 1, $3::jsonb, $4::jsonb)
    `, [ids.batchId, RECRUITER_ID, plan, wording]);
    await pool.query(`
        insert into public.recruiter_invitation_recipients (
          recruiter_invitation_recipient_id, recruiter_invitation_batch_id, recruiter_id,
          candidate_index, first_name, last_name, email, normalized_email, lifecycle_state
        ) values ($1, $2, $3, 0, 'Smoke', 'Candidate',
          'invited-repeat@example.invalid', 'invited-repeat@example.invalid', 'ready')
    `, [ids.recipientId, ids.batchId, RECRUITER_ID]);
    await pool.query(`
        insert into public.invited_practice_sessions (
          invited_practice_session_id, recruiter_invitation_recipient_id, recruiter_id,
          attempt_number, status, setup_snapshot_json, question_plan_snapshot_json,
          question_wording_snapshot_json, progress_state_json, answer_submissions_json,
          completion_snapshot_json
        ) values ($1, $2, $3, 1, 'completed', $4::jsonb, $5::jsonb, $6::jsonb,
          '{"status":"completed","currentQuestionIndex":0}'::jsonb,
          $7::jsonb, $8::jsonb)
    `, [
        ids.parentSessionId,
        ids.recipientId,
        RECRUITER_ID,
        setup,
        plan,
        wording,
        { "slot-1": { slotId: "slot-1", questionIndex: 0, mode: "text", text: "I value careful work.", submittedAt: now.toISOString(), status: "pending_analysis" } },
        { status: "invited_session_completed", audience: "invited_candidate", sessionId: ids.parentSessionId, completedAt: now.toISOString(), finalProgress: { status: "completed", currentQuestionIndex: 0 }, questionCount: 1, answeredCount: 1, coachedCount: 0, answeredQuestionKeys: ["slot-1"], coachedQuestionKeys: [], skippedOrUnansweredQuestionKeys: [], nextRoute: "/candidate/invited" },
    ]);
    await pool.query(`
        insert into public.invited_practice_answer_attempts (
          invited_practice_session_id, recruiter_invitation_recipient_id, question_slot_id,
          question_index, attempt_number, trigger, mode, answer_text, submitted_at,
          idempotency_key, payload_fingerprint
        ) values ($1, $2, 'slot-1', 0, 1, 'initial_submit', 'text',
          'I value careful work.', $3, 'repeat-smoke-answer', 'repeat-smoke-fingerprint')
    `, [ids.parentSessionId, ids.recipientId, now]);
    await pool.query(`
        insert into public.invited_practice_access_tokens (
          invited_practice_access_token_id, invited_practice_session_id,
          recruiter_invitation_recipient_id, token_hash, token_ciphertext,
          encryption_key_id, expires_at
        ) values ($1, $2, $3, $4, 'smoke-ciphertext', 'smoke-key', $5)
    `, [ids.accessTokenId, ids.parentSessionId, ids.recipientId, ids.invitationTokenHash, expiresAt]);
    await pool.query(`
        insert into public.invited_practice_browser_sessions (
          invited_practice_browser_session_id, invited_practice_access_token_id,
          session_token_hash, expires_at
        ) values ($1, $2, $3, $4)
    `, [ids.sourceBrowserSessionId, ids.accessTokenId, ids.sourceBrowserTokenHash, expiresAt]);
    await pool.query(`
        insert into public.invited_practice_entry_signals (
          invited_practice_session_id, recruiter_invitation_recipient_id,
          entered_initials, expected_initials, match_state
        ) values ($1, $2, 'SC', 'SC', 'match')
    `, [ids.parentSessionId, ids.recipientId]);
}

function hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
