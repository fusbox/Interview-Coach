import { describe, expect, it, vi } from "vitest";

import { createInvitedServiceRepository } from "./invited-service-repository";

describe("invited voice transcription route adapter", () => {
    it("maps the opaque audience owner only to invitation-recipient persistence", async () => {
        const claimRun = vi.fn(async () => null);
        const completeRunAndSaveDraft = vi.fn(async () => null);
        const failRun = vi.fn(async () => null);
        const repository = createInvitedServiceRepository({
            claimRun,
            completeRunAndSaveDraft,
            failRun,
        } as never);
        const common = {
            voiceTranscriptionRunId: "run-1",
            practiceSessionId: "session-1",
            audienceOwnerId: "recipient-1",
        };
        await repository.claimRun({
            ...common,
            questionSlotId: "slot-1",
            questionIndex: 0,
            idempotencyKeyHash: "a".repeat(64),
            audioInputFingerprint: "b".repeat(64),
            acceptedMimeType: "audio/webm",
            audioByteCount: 100,
            audioDurationMs: 1000,
            submissionPath: "quick_submit",
            provider: "fixture",
            profileId: "fixture-v1",
            modelName: "fixture-model",
            configurationFingerprint: "c".repeat(64),
            requestedAt: "2026-07-21T12:00:00.000Z",
            claimExpiresAt: "2026-07-21T12:02:00.000Z",
        });
        expect(claimRun).toHaveBeenCalledWith(expect.objectContaining({
            invitedPracticeSessionId: "session-1",
            recruiterInvitationRecipientId: "recipient-1",
        }));
        expect(claimRun).toHaveBeenCalledWith(expect.not.objectContaining({ candidateProfileId: expect.anything() }));
    });
});
