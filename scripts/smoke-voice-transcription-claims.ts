import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { createCandidateVoiceTranscriptionRepository } from "../src/features/candidate-session-v2/candidate-voice-transcription-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const databaseUrl = process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl();
const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
    max: 8,
    application_name: "interview-coach-voice-transcription-claims-smoke",
});
const queryClient = {
    async query(sql: string, values: unknown[]) {
        const result = await pool.query(sql, values);
        return { rows: result.rows as Array<Record<string, unknown>> };
    },
};
const repository = createCandidateVoiceTranscriptionRepository(queryClient);
const candidateProfileId = randomUUID();
const sessionId = randomUUID();
const idempotencyKeyHash = "1".repeat(64);
const audioFingerprint = "2".repeat(64);
const configurationFingerprint = "3".repeat(64);

async function main() {
try {
    await pool.query(`
        insert into public.candidate_profiles (
          candidate_profile_id, auth_subject, email, display_name, workspace
        ) values ($1, $2, $3, 'Voice Claim Smoke', 'local_dev')
    `, [
        candidateProfileId,
        `local_dev:voice-claim-smoke:${candidateProfileId}`,
        `voice-claim-smoke-${candidateProfileId}@example.invalid`,
    ]);
    await pool.query(`
        insert into public.candidate_practice_sessions (
          candidate_practice_session_id,
          candidate_profile_id,
          status,
          setup_snapshot_json,
          question_plan_snapshot_json,
          question_wording_snapshot_json,
          question_wording_status,
          progress_state_json
        ) values (
          $1, $2, 'in_progress',
          '{"targetRole":"Inspector","interviewStage":"screening","questionCount":1}'::jsonb,
          '{"interviewStage":"screening","questionCount":1,"slots":[{"id":"slot-1","index":0,"category":"screening"}]}'::jsonb,
          '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"Why are you interested?"}]}'::jsonb,
          'worded',
          '{"status":"active","currentQuestionIndex":0}'::jsonb
        )
    `, [sessionId, candidateProfileId]);

    const requestedAt = new Date().toISOString();
    const claimExpiresAt = new Date(Date.now() + 120_000).toISOString();
    const makeClaim = (overrides: Partial<Parameters<typeof repository.claimRun>[0]> = {}) => repository.claimRun({
        candidateVoiceTranscriptionRunId: randomUUID(),
        candidatePracticeSessionId: sessionId,
        candidateProfileId,
        questionSlotId: "slot-1",
        questionIndex: 0,
        idempotencyKeyHash,
        audioInputFingerprint: audioFingerprint,
        acceptedMimeType: "audio/webm",
        audioByteCount: 2048,
        audioDurationMs: 5000,
        submissionPath: "quick_submit",
        provider: "fixture",
        profileId: "fixture_voice_transcription_v1",
        modelName: "fixture-model",
        configurationFingerprint,
        requestedAt,
        claimExpiresAt,
        ...overrides,
    });

    const concurrent = await Promise.all(Array.from({ length: 8 }, () => makeClaim()));
    const concurrentSummary = concurrent.map((result) => result?.outcome ?? "null").join(",");
    assert.equal(
        concurrent.filter((result) => result?.outcome === "acquired").length,
        1,
        concurrentSummary,
    );
    assert.equal(
        concurrent.filter((result) => result?.outcome === "in_progress").length,
        7,
        concurrentSummary,
    );
    const acquired = concurrent.find((result) => result?.outcome === "acquired");
    assert(acquired?.run);

    const completedAt = new Date().toISOString();
    const completion = await repository.completeRunAndSaveDraft({
        candidateVoiceTranscriptionRunId: acquired.run.voiceTranscriptionRunId,
        candidatePracticeSessionId: sessionId,
        candidateProfileId,
        questionSlotId: "slot-1",
        questionIndex: 0,
        transcriptText: "I inspect each item against the documented standard.",
        submissionPath: "quick_submit",
        completedAt,
    });
    assert(completion);
    assert.equal((await makeClaim())?.outcome, "replayed");
    assert.equal((await repository.recoverRun({
        candidatePracticeSessionId: sessionId,
        candidateProfileId,
        questionSlotId: "slot-1",
        questionIndex: 0,
        idempotencyKeyHash,
        audioInputFingerprint: audioFingerprint,
        submissionPath: "quick_submit",
    }))?.outcome, "replayed");
    assert.equal((await makeClaim({ audioInputFingerprint: "4".repeat(64) }))?.outcome, "idempotency_conflict");

    const staleKey = "5".repeat(64);
    const staleRequestedAt = new Date(Date.now() - 240_000).toISOString();
    const staleExpiresAt = new Date(Date.now() - 120_000).toISOString();
    const stale = await makeClaim({
        idempotencyKeyHash: staleKey,
        requestedAt: staleRequestedAt,
        claimExpiresAt: staleExpiresAt,
    });
    assert.equal(stale?.outcome, "acquired");
    const recovered = await makeClaim({ idempotencyKeyHash: staleKey });
    assert.equal(recovered?.outcome, "acquired");
    assert.equal(recovered?.run?.generationAttempt, 2);

    console.log("Voice transcription claim smoke passed: one concurrent owner, replay, conflict, stale generation recovery.");
} finally {
    await pool.query(
        "delete from public.candidate_profiles where candidate_profile_id = $1",
        [candidateProfileId],
    ).catch(() => undefined);
    await pool.end();
}
}

void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
