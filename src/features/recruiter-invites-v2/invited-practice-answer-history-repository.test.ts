import { describe, expect, it, vi } from "vitest";

import {
    createInvitedPracticeAnswerHistoryRepository,
    createInvitedPracticeCandidateAnswerHistoryAdapter,
} from "./invited-practice-answer-history-repository";

describe("invited practice answer history repository", () => {
    it("authorizes a reviewed transcript against the current recipient-owned voice source", async () => {
        const sourceRunId = "44444444-4444-4444-8444-444444444444";
        const transcriptDraft = {
            status: "voice_transcript_draft",
            slotId: "slot-1",
            questionIndex: 0,
            transcriptText: "I checked each label and documented the result.",
            sourceTranscriptionRunId: sourceRunId,
            submissionPath: "transcript_review",
            updatedAt: "2026-07-21T17:00:00.000Z",
        };
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return {
            rows: [{
                transcript_draft: transcriptDraft,
                voice_transcript_edited: true,
            }],
            };
        });
        const repository = createInvitedPracticeAnswerHistoryRepository({ query });
        const adapter = createInvitedPracticeCandidateAnswerHistoryAdapter(repository);

        await expect(adapter.authorizeVoiceAnswerTranscript({
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            questionSlotId: "slot-1",
            questionIndex: 0,
            sourceVoiceTranscriptionRunId: sourceRunId,
            voiceSubmissionPath: "transcript_review",
            transcriptText: transcriptDraft.transcriptText,
            updatedAt: transcriptDraft.updatedAt,
        })).resolves.toEqual({
            draft: transcriptDraft,
            voiceTranscriptEdited: true,
        });

        expect(query).toHaveBeenCalledWith(
            expect.stringMatching(/update public\.invited_practice_sessions[\s\S]+sourceTranscriptionRunId[\s\S]+quick_submit/),
            [
                "11111111-1111-4111-8111-111111111111",
                "22222222-2222-4222-8222-222222222222",
                "slot-1",
                0,
                sourceRunId,
                "transcript_review",
                transcriptDraft.transcriptText,
                transcriptDraft.updatedAt,
            ],
        );
        expect(query.mock.calls[0]?.[0]).toContain("sourceTranscriptionRunId' = $5::text");
    });

    it("normalizes an invited source-linked voice attempt through the shared answer contract", async () => {
        const sourceRunId = "44444444-4444-4444-8444-444444444444";
        const query = vi.fn(async () => ({
            rows: [{
                write_outcome: "created",
                invited_practice_answer_attempt_id: "55555555-5555-4555-8555-555555555555",
                invited_practice_session_id: "11111111-1111-4111-8111-111111111111",
                recruiter_invitation_recipient_id: "22222222-2222-4222-8222-222222222222",
                question_slot_id: "slot-1",
                question_index: 0,
                attempt_number: 1,
                trigger: "initial_submit",
                supersedes_invited_practice_answer_attempt_id: null,
                mode: "voice",
                answer_text: "I checked each label and documented the result.",
                submitted_at: "2026-07-21T17:01:00.000Z",
                idempotency_key: "voice-answer-1",
                payload_fingerprint: "payload-1",
                source_invited_voice_transcription_run_id: sourceRunId,
                voice_submission_path: "transcript_review",
                voice_transcript_edited: true,
                created_at: "2026-07-21T17:01:00.000Z",
            }],
        }));
        const repository = createInvitedPracticeAnswerHistoryRepository({ query });

        await expect(repository.appendAnswerAttempt({
            invitedPracticeSessionId: "11111111-1111-4111-8111-111111111111",
            recruiterInvitationRecipientId: "22222222-2222-4222-8222-222222222222",
            questionSlotId: "slot-1",
            questionIndex: 0,
            mode: "voice",
            answerText: "I checked each label and documented the result.",
            submittedAt: "2026-07-21T17:01:00.000Z",
            trigger: "initial_submit",
            idempotencyKey: "voice-answer-1",
            payloadFingerprint: "payload-1",
            sourceVoiceTranscriptionRunId: sourceRunId,
            voiceSubmissionPath: "transcript_review",
            voiceTranscriptEdited: true,
        })).resolves.toMatchObject({
            outcome: "created",
            attempt: {
                sourceVoiceTranscriptionRunId: sourceRunId,
                mode: "voice",
            },
        });
    });
});
