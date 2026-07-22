import { describe, expect, it, vi } from "vitest";

import { createVoiceTranscriptFingerprint } from "@/features/interview-session-v2/voice-answer-transcription-server";

import { createCandidateVoiceTranscriptionRepository } from "./candidate-voice-transcription-repository";

const hash = "a".repeat(64);
const runRow = {
    candidate_voice_transcription_run_id: "11111111-1111-4111-8111-111111111111",
    candidate_practice_session_id: "22222222-2222-4222-8222-222222222222",
    candidate_profile_id: "33333333-3333-4333-8333-333333333333",
    question_slot_id: "slot-1",
    question_index: 0,
    idempotency_key_hash: hash,
    audio_input_fingerprint: hash,
    accepted_mime_type: "audio/webm",
    audio_byte_count: 1024,
    audio_duration_ms: 5000,
    submission_path: "quick_submit",
    provider: "fixture",
    profile_id: "fixture-v1",
    model_name: "fixture-model",
    configuration_fingerprint: hash,
    generation_attempt: 1,
    lifecycle_state: "requested",
    output_fingerprint: null,
    error_code: null,
    requested_at: "2026-07-20T16:00:00.000Z",
    claim_expires_at: "2026-07-20T16:01:00.000Z",
    completed_at: null,
    created_at: "2026-07-20T16:00:00.000Z",
    updated_at: "2026-07-20T16:00:00.000Z",
};

describe("candidate voice transcription repository", () => {
    it("claims one generation under an owned-slot advisory lock", async () => {
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return {
            rows: [{ ...runRow, claim_outcome: "acquired" }],
            };
        });
        const repository = createCandidateVoiceTranscriptionRepository({ query });
        await expect(repository.claimRun({
            candidateVoiceTranscriptionRunId: runRow.candidate_voice_transcription_run_id,
            candidatePracticeSessionId: runRow.candidate_practice_session_id,
            candidateProfileId: runRow.candidate_profile_id,
            questionSlotId: "slot-1",
            questionIndex: 0,
            idempotencyKeyHash: hash,
            audioInputFingerprint: hash,
            acceptedMimeType: "audio/webm",
            audioByteCount: 1024,
            audioDurationMs: 5000,
            submissionPath: "quick_submit",
            provider: "fixture",
            profileId: "fixture-v1",
            modelName: "fixture-model",
            configurationFingerprint: hash,
            requestedAt: "2026-07-20T16:00:00.000Z",
            claimExpiresAt: "2026-07-20T16:02:00.000Z",
        })).resolves.toMatchObject({ outcome: "acquired", run: { generationAttempt: 1 } });
        const sql = query.mock.calls[0]?.[0] ?? "";
        expect(sql).toContain("pg_advisory_xact_lock");
        expect(sql).toContain("STALE_TRANSCRIPTION_CLAIM");
        expect(sql).toContain("idempotency_conflict");
        expect(sql).toContain("generation_limit");
    });

    it("creates metadata only after proving the exact owned session slot", async () => {
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return { rows: [runRow] };
        });
        const repository = createCandidateVoiceTranscriptionRepository({ query });
        await expect(repository.createRequestedRun({
            candidateVoiceTranscriptionRunId: runRow.candidate_voice_transcription_run_id,
            candidatePracticeSessionId: runRow.candidate_practice_session_id,
            candidateProfileId: runRow.candidate_profile_id,
            questionSlotId: "slot-1",
            questionIndex: 0,
            idempotencyKeyHash: hash,
            audioInputFingerprint: hash,
            acceptedMimeType: "audio/webm",
            audioByteCount: 1024,
            audioDurationMs: 5000,
            submissionPath: "quick_submit",
            provider: "fixture",
            profileId: "fixture-v1",
            modelName: "fixture-model",
            configurationFingerprint: hash,
            generationAttempt: 1,
            requestedAt: "2026-07-20T16:00:00.000Z",
            claimExpiresAt: "2026-07-20T16:01:00.000Z",
        })).resolves.toMatchObject({ audienceOwnerId: runRow.candidate_profile_id });
        const sql = query.mock.calls[0]?.[0] ?? "";
        expect(sql).toContain("candidate_profile_id = $3");
        expect(sql).toContain("jsonb_array_elements");
        expect(sql).not.toContain("transcript_text");
        expect(sql).not.toContain("raw_audio");
    });

    it("completes the run and saves its recoverable draft in one statement", async () => {
        const transcript = "I checked every package against the documented standard.";
        const outputFingerprint = createVoiceTranscriptFingerprint(transcript);
        const completedAt = "2026-07-20T16:00:05.000Z";
        const completedRow = {
            ...runRow,
            lifecycle_state: "completed",
            output_fingerprint: outputFingerprint,
            completed_at: completedAt,
            updated_at: completedAt,
            voice_transcript_drafts_json: {
                "slot-1": {
                    status: "voice_transcript_draft",
                    slotId: "slot-1",
                    questionIndex: 0,
                    transcriptText: transcript,
                    sourceTranscriptionRunId: runRow.candidate_voice_transcription_run_id,
                    submissionPath: "quick_submit",
                    updatedAt: completedAt,
                },
            },
        };
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return { rows: [completedRow] };
        });
        const repository = createCandidateVoiceTranscriptionRepository({ query });
        await expect(repository.completeRunAndSaveDraft({
            candidateVoiceTranscriptionRunId: runRow.candidate_voice_transcription_run_id,
            candidatePracticeSessionId: runRow.candidate_practice_session_id,
            candidateProfileId: runRow.candidate_profile_id,
            questionSlotId: "slot-1",
            questionIndex: 0,
            transcriptText: transcript,
            submissionPath: "quick_submit",
            completedAt,
        })).resolves.toMatchObject({
            run: { lifecycleState: "completed" },
            draft: { transcriptText: transcript, submissionPath: "quick_submit" },
        });
        expect(query.mock.calls[0]?.[0]).toMatch(/with owned_session[\s\S]+completed as[\s\S]+saved as/);
        expect(query.mock.calls[0]?.[1]?.[5]).toBe(outputFingerprint);
    });
});
