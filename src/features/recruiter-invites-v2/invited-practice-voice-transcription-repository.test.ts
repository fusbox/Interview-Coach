import { describe, expect, it, vi } from "vitest";

import { createVoiceTranscriptFingerprint } from "@/features/interview-session-v2/voice-answer-transcription-server";

import { createInvitedPracticeVoiceTranscriptionRepository } from "./invited-practice-voice-transcription-repository";

const hash = "b".repeat(64);
const runRow = {
    invited_practice_voice_transcription_run_id: "11111111-1111-4111-8111-111111111111",
    invited_practice_session_id: "22222222-2222-4222-8222-222222222222",
    recruiter_invitation_recipient_id: "33333333-3333-4333-8333-333333333333",
    question_slot_id: "slot-1",
    question_index: 0,
    idempotency_key_hash: hash,
    audio_input_fingerprint: hash,
    accepted_mime_type: "audio/webm",
    audio_byte_count: 2048,
    audio_duration_ms: null,
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

describe("invited voice transcription repository", () => {
    it("claims only under invitation-recipient ownership", async () => {
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return {
            rows: [{ ...runRow, claim_outcome: "in_progress" }],
            };
        });
        const repository = createInvitedPracticeVoiceTranscriptionRepository({ query });
        await expect(repository.claimRun({
            invitedPracticeVoiceTranscriptionRunId: runRow.invited_practice_voice_transcription_run_id,
            invitedPracticeSessionId: runRow.invited_practice_session_id,
            recruiterInvitationRecipientId: runRow.recruiter_invitation_recipient_id,
            questionSlotId: "slot-1",
            questionIndex: 0,
            idempotencyKeyHash: hash,
            audioInputFingerprint: hash,
            acceptedMimeType: "audio/webm",
            audioByteCount: 2048,
            audioDurationMs: 5000,
            submissionPath: "quick_submit",
            provider: "fixture",
            profileId: "fixture-v1",
            modelName: "fixture-model",
            configurationFingerprint: hash,
            requestedAt: "2026-07-20T16:00:00.000Z",
            claimExpiresAt: "2026-07-20T16:02:00.000Z",
        })).resolves.toMatchObject({ outcome: "in_progress" });
        const sql = query.mock.calls[0]?.[0] ?? "";
        expect(sql).toContain("recruiter_invitation_recipient_id = $3");
        expect(sql).toContain("pg_advisory_xact_lock");
        expect(sql).not.toContain("candidate_profiles");
    });

    it("uses recipient ownership and never crosses into candidate persistence", async () => {
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return { rows: [runRow] };
        });
        const repository = createInvitedPracticeVoiceTranscriptionRepository({ query });
        await expect(repository.createRequestedRun({
            invitedPracticeVoiceTranscriptionRunId: runRow.invited_practice_voice_transcription_run_id,
            invitedPracticeSessionId: runRow.invited_practice_session_id,
            recruiterInvitationRecipientId: runRow.recruiter_invitation_recipient_id,
            questionSlotId: "slot-1",
            questionIndex: 0,
            idempotencyKeyHash: hash,
            audioInputFingerprint: hash,
            acceptedMimeType: "audio/webm",
            audioByteCount: 2048,
            submissionPath: "quick_submit",
            provider: "fixture",
            profileId: "fixture-v1",
            modelName: "fixture-model",
            configurationFingerprint: hash,
            generationAttempt: 1,
            requestedAt: "2026-07-20T16:00:00.000Z",
            claimExpiresAt: "2026-07-20T16:01:00.000Z",
        })).resolves.toMatchObject({ audienceOwnerId: runRow.recruiter_invitation_recipient_id });
        const sql = query.mock.calls[0]?.[0] ?? "";
        expect(sql).toContain("recruiter_invitation_recipient_id = $3");
        expect(sql).toContain("public.invited_practice_voice_transcription_runs");
        expect(sql).not.toContain("candidate_profiles");
        expect(sql).not.toContain("raw_audio");
    });

    it("returns no durable work when recipient ownership does not resolve", async () => {
        const query = vi.fn(async () => ({ rows: [] }));
        const repository = createInvitedPracticeVoiceTranscriptionRepository({ query });
        await expect(repository.findOwnedRun({
            invitedPracticeVoiceTranscriptionRunId: runRow.invited_practice_voice_transcription_run_id,
            invitedPracticeSessionId: runRow.invited_practice_session_id,
            recruiterInvitationRecipientId: "foreign-recipient",
        })).resolves.toBeNull();
    });

    it("derives the immutable output fingerprint from the saved transcript", async () => {
        const transcript = "I compared the finished item with the documented standard.";
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
                    sourceTranscriptionRunId: runRow.invited_practice_voice_transcription_run_id,
                    submissionPath: "transcript_review",
                    updatedAt: completedAt,
                },
            },
        };
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return { rows: [completedRow] };
        });
        const repository = createInvitedPracticeVoiceTranscriptionRepository({ query });

        await expect(repository.completeRunAndSaveDraft({
            invitedPracticeVoiceTranscriptionRunId: runRow.invited_practice_voice_transcription_run_id,
            invitedPracticeSessionId: runRow.invited_practice_session_id,
            recruiterInvitationRecipientId: runRow.recruiter_invitation_recipient_id,
            questionSlotId: "slot-1",
            questionIndex: 0,
            transcriptText: transcript,
            submissionPath: "transcript_review",
            completedAt,
        })).resolves.toMatchObject({
            run: { lifecycleState: "completed", outputFingerprint },
            draft: { transcriptText: transcript, submissionPath: "transcript_review" },
        });
        expect(query.mock.calls[0]?.[1]?.[5]).toBe(outputFingerprint);
    });
});
