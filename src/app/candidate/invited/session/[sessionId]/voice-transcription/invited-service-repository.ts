import type { VoiceTranscriptionServiceRepository } from "@/features/interview-session-v2/voice-transcription-service";
import { createInvitedPracticeVoiceTranscriptionRepository } from "@/features/recruiter-invites-v2/invited-practice-voice-transcription-repository";

export function createInvitedServiceRepository(
    repository: ReturnType<typeof createInvitedPracticeVoiceTranscriptionRepository>,
): VoiceTranscriptionServiceRepository {
    return {
        claimRun: (value) => repository.claimRun({
            invitedPracticeVoiceTranscriptionRunId: value.voiceTranscriptionRunId,
            invitedPracticeSessionId: value.practiceSessionId,
            recruiterInvitationRecipientId: value.audienceOwnerId,
            questionSlotId: value.questionSlotId,
            questionIndex: value.questionIndex,
            idempotencyKeyHash: value.idempotencyKeyHash,
            audioInputFingerprint: value.audioInputFingerprint,
            acceptedMimeType: value.acceptedMimeType,
            audioByteCount: value.audioByteCount,
            audioDurationMs: value.audioDurationMs,
            submissionPath: value.submissionPath,
            provider: value.provider,
            profileId: value.profileId,
            modelName: value.modelName,
            configurationFingerprint: value.configurationFingerprint,
            requestedAt: value.requestedAt,
            claimExpiresAt: value.claimExpiresAt,
        }),
        recoverRun: (value) => repository.recoverRun({
            invitedPracticeSessionId: value.practiceSessionId,
            recruiterInvitationRecipientId: value.audienceOwnerId,
            questionSlotId: value.questionSlotId,
            questionIndex: value.questionIndex,
            idempotencyKeyHash: value.idempotencyKeyHash,
            audioInputFingerprint: value.audioInputFingerprint,
            submissionPath: value.submissionPath,
        }),
        completeRunAndSaveDraft: (value) => repository.completeRunAndSaveDraft({
            invitedPracticeVoiceTranscriptionRunId: value.voiceTranscriptionRunId,
            invitedPracticeSessionId: value.practiceSessionId,
            recruiterInvitationRecipientId: value.audienceOwnerId,
            questionSlotId: value.questionSlotId,
            questionIndex: value.questionIndex,
            transcriptText: value.transcriptText,
            submissionPath: value.submissionPath,
            completedAt: value.completedAt,
        }),
        failRun: (value) => repository.failRun({
            invitedPracticeVoiceTranscriptionRunId: value.voiceTranscriptionRunId,
            invitedPracticeSessionId: value.practiceSessionId,
            recruiterInvitationRecipientId: value.audienceOwnerId,
            errorCode: value.errorCode,
            completedAt: value.completedAt,
        }),
    };
}
