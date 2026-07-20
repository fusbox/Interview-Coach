import { createHash, randomUUID } from "node:crypto";

import { Pool } from "pg";

import { createInvitedPracticeAccessRepository } from "../src/features/recruiter-invites-v2/invited-practice-access-repository";
import { hashInvitedPracticeToken } from "../src/features/recruiter-invites-v2/invited-practice-token-vault";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const RECRUITER_ID = "20000000-0000-4000-8000-000000000001";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl(),
        max: 4,
        application_name: "interview-coach-invited-access-smoke",
    });
    const repository = createInvitedPracticeAccessRepository({
        query: (sql, values) => pool.query(sql, values),
    });
    const batchId = randomUUID();
    const recipientId = randomUUID();
    const sessionId = randomUUID();
    const accessTokenId = randomUUID();
    const rawInvitationToken = createHash("sha256").update(randomUUID()).digest("base64url").slice(0, 43);
    const sourceExpiresAt = new Date(Date.now() + 60 * 60 * 1_000);

    try {
        await pool.query(`
            insert into public.recruiter_invitation_batches (
              recruiter_invitation_batch_id, recruiter_id, lifecycle_state, target_role,
              interview_stage, recipient_count, question_plan_snapshot_json, question_wording_snapshot_json
            ) values ($1, $2, 'ready', 'Invited access smoke', 'screening', 1,
              '{"questionCount":1}'::jsonb,
              '{"status":"questions_worded","questions":[]}'::jsonb)
        `, [batchId, RECRUITER_ID]);
        await pool.query(`
            insert into public.recruiter_invitation_recipients (
              recruiter_invitation_recipient_id, recruiter_invitation_batch_id, recruiter_id,
              candidate_index, first_name, last_name, email, normalized_email, lifecycle_state
            ) values ($1, $2, $3, 0, 'Smoke', 'Candidate',
              'invited-access@example.invalid', 'invited-access@example.invalid', 'ready')
        `, [recipientId, batchId, RECRUITER_ID]);
        await pool.query(`
            insert into public.invited_practice_sessions (
              invited_practice_session_id, recruiter_invitation_recipient_id, recruiter_id,
              attempt_number, status, setup_snapshot_json, question_plan_snapshot_json,
              question_wording_snapshot_json, progress_state_json
            ) values ($1, $2, $3, 1, 'planned',
              '{"targetRole":"Invited access smoke","interviewStage":"screening"}'::jsonb,
              '{"questionCount":1}'::jsonb,
              '{"status":"questions_worded","questions":[]}'::jsonb,
              '{"status":"planned","currentQuestionIndex":0}'::jsonb)
        `, [sessionId, recipientId, RECRUITER_ID]);
        await pool.query(`
            insert into public.invited_practice_access_tokens (
              invited_practice_access_token_id, invited_practice_session_id,
              recruiter_invitation_recipient_id, token_hash, token_ciphertext,
              encryption_key_id, expires_at
            ) values ($1, $2, $3, $4, 'smoke-ciphertext', 'smoke-key', $5)
        `, [accessTokenId, sessionId, recipientId, hashInvitedPracticeToken(rawInvitationToken), sourceExpiresAt]);

        const browserSessionId = randomUUID();
        const browserTokenHash = hash(`browser:${randomUUID()}`);
        const exchanged = await repository.exchangeInvitationToken({
            invitationTokenHash: hashInvitedPracticeToken(rawInvitationToken),
            browserSessionId,
            browserSessionTokenHash: browserTokenHash,
            requestedExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString(),
        });
        assert(exchanged, "Active invitation token did not exchange.");
        assert(
            new Date(exchanged.browserSessionExpiresAt).getTime() <= sourceExpiresAt.getTime(),
            "Browser access exceeded the source invitation expiry.",
        );
        assert(await repository.resolveBrowserSession(browserTokenHash), "Clean-route browser access did not resolve.");

        const concurrentSignals = await Promise.all(Array.from({ length: 8 }, (_, index) => (
            repository.confirmInitials({
                sessionTokenHash: browserTokenHash,
                enteredInitials: index % 2 === 0 ? "XX" : "SC",
            })
        )));
        const winningInitials = concurrentSignals[0]?.signal.enteredInitials;
        assert(winningInitials, "Concurrent initials did not persist a winning signal.");
        assert(
            concurrentSignals.every((result) => result?.signal.enteredInitials === winningInitials),
            "Concurrent initials did not converge to one first-write signal.",
        );
        const replay = await repository.confirmInitials({
            sessionTokenHash: browserTokenHash,
            enteredInitials: winningInitials === "SC" ? "XX" : "SC",
        });
        assert(replay?.signal.enteredInitials === winningInitials, "Later initials rewrote first-entry evidence.");

        let signalImmutable = false;
        try {
            await pool.query(`
                update public.invited_practice_entry_signals
                set entered_initials = 'SC', expected_initials = 'SC', match_state = 'match'
                where invited_practice_session_id = $1
            `, [sessionId]);
        } catch (error) {
            signalImmutable = readPostgresCode(error) === "55000";
        }
        assert(signalImmutable, "Initials evidence was mutable.");

        await pool.query(`
            update public.invited_practice_access_tokens
            set revoked_at = greatest(clock_timestamp(), created_at)
            where invited_practice_access_token_id = $1
        `, [accessTokenId]);
        assert(
            await repository.resolveBrowserSession(browserTokenHash) === null,
            "Revoking the source invitation left browser access active.",
        );

        console.log("Invited practice access smoke passed.");
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
