import { describe, expect, it } from "vitest";

import {
    createVoiceTranscriptDraft,
    isVoiceTranscriptDraftResolvedByAnswer,
    normalizeVoiceTranscriptDrafts,
    normalizeVoiceTranscriptionRunRecord,
} from "./voice-answer-transcription";
import {
    createVoiceOperationKeyHash,
    createVoiceTranscriptFingerprint,
} from "./voice-answer-transcription-server";

const hash = "a".repeat(64);

describe("voice answer transcription domain", () => {
    it("creates stable hashes without accepting blank source values", () => {
        expect(createVoiceOperationKeyHash(" command-1 ")).toBe(createVoiceOperationKeyHash("command-1"));
        expect(createVoiceTranscriptFingerprint(" answer text ")).toBe(createVoiceTranscriptFingerprint("answer text"));
        expect(() => createVoiceOperationKeyHash(" ")).toThrow("voice operation key");
        expect(() => createVoiceTranscriptFingerprint(" ")).toThrow("nonblank voice transcript");
    });

    it("normalizes only complete recoverable transcript drafts", () => {
        const draft = createVoiceTranscriptDraft({
            slotId: "slot-1",
            questionIndex: 0,
            transcriptText: "I checked the documented standard.",
            sourceTranscriptionRunId: "11111111-1111-4111-8111-111111111111",
            submissionPath: "transcript_review",
            updatedAt: "2026-07-20T16:00:00.000Z",
        });
        expect(normalizeVoiceTranscriptDrafts({
            "slot-1": draft,
            "wrong-slot": draft,
            broken: { status: "voice_transcript_draft" },
        }))
            .toEqual({ "slot-1": draft });
    });

    it("does not recover a transcript already resolved by a later answer", () => {
        const draft = createVoiceTranscriptDraft({
            slotId: "slot-1",
            questionIndex: 0,
            transcriptText: "I checked the documented standard.",
            sourceTranscriptionRunId: "11111111-1111-4111-8111-111111111111",
            submissionPath: "transcript_review",
            updatedAt: "2026-07-20T16:00:00.000Z",
        });

        expect(isVoiceTranscriptDraftResolvedByAnswer(draft, {
            submittedAt: "2026-07-20T16:00:01.000Z",
            sourceVoiceTranscriptionRunId: draft.sourceTranscriptionRunId,
        })).toBe(true);
        expect(isVoiceTranscriptDraftResolvedByAnswer(draft, {
            submittedAt: "2026-07-20T16:00:01.000Z",
            sourceVoiceTranscriptionRunId: null,
        })).toBe(true);
        expect(isVoiceTranscriptDraftResolvedByAnswer(draft, {
            submittedAt: "2026-07-20T15:59:59.000Z",
            sourceVoiceTranscriptionRunId: null,
        })).toBe(false);
    });

    it("rejects lifecycle rows whose output shape contradicts their state", () => {
        const requested = {
            voice_transcription_run_id: "11111111-1111-4111-8111-111111111111",
            practice_session_id: "22222222-2222-4222-8222-222222222222",
            audience_owner_id: "33333333-3333-4333-8333-333333333333",
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
        expect(normalizeVoiceTranscriptionRunRecord(requested)).toMatchObject({ lifecycleState: "requested" });
        expect(normalizeVoiceTranscriptionRunRecord({
            ...requested,
            lifecycle_state: "completed",
        })).toBeNull();
        expect(normalizeVoiceTranscriptionRunRecord({
            ...requested,
            lifecycle_state: "completed",
            output_fingerprint: hash,
            completed_at: "2026-07-20T16:00:05.000Z",
        })).toMatchObject({ lifecycleState: "completed", outputFingerprint: hash });
    });
});
