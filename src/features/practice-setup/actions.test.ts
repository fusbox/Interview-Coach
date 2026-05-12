import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    createCandidateSessionFromDraftMock,
    resolveCandidateProfileFromIdentityMock,
    resolveLocalCandidateAuthHandoffMock,
    transitionCandidatePracticeDraftToGeneratingMock,
} = vi.hoisted(() => ({
    createCandidateSessionFromDraftMock: vi.fn(),
    resolveCandidateProfileFromIdentityMock: vi.fn(),
    resolveLocalCandidateAuthHandoffMock: vi.fn(),
    transitionCandidatePracticeDraftToGeneratingMock: vi.fn(),
}));

vi.mock("@/lib/server/candidate/candidate-dev-auth-resolver", () => ({
    resolveLocalCandidateAuthHandoff: resolveLocalCandidateAuthHandoffMock,
}));

vi.mock("@/lib/server/candidate/candidate-profile-repository", () => ({
    resolveCandidateProfileFromIdentity: resolveCandidateProfileFromIdentityMock,
}));

vi.mock("@/lib/server/candidate/candidate-practice-draft-repository", () => ({
    transitionCandidatePracticeDraftToGenerating: transitionCandidatePracticeDraftToGeneratingMock,
}));

vi.mock("@/lib/server/candidate/candidate-session-creation-service", () => ({
    createCandidateSessionFromDraft: createCandidateSessionFromDraftMock,
}));

describe("practice setup actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("transitions the restored draft into generation state", async () => {
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue({
            provider: "dev_mock",
            issuer: "interview-coach-local",
            subject: "candidate@example.com",
            email: "candidate@example.com",
            workspace: "local_dev",
        });
        resolveCandidateProfileFromIdentityMock.mockResolvedValue({
            candidateProfileId: "profile-1",
        });
        transitionCandidatePracticeDraftToGeneratingMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            status: "generating",
            resumeTargetScreen: "practice_generating",
        });
        createCandidateSessionFromDraftMock.mockResolvedValue({
            ok: true,
            practiceDraftId: "draft-1",
            sessionId: "session-1",
            questionSetSnapshotId: "snapshot-1",
            resumeTargetScreen: "session_entry",
        });

        const { startPracticeGenerationAction } = await import("./actions");

        await expect(startPracticeGenerationAction("draft-1")).resolves.toEqual({
            ok: true,
            practiceDraftId: "draft-1",
            sessionId: "session-1",
            resumeTargetScreen: "session_entry",
        });
        expect(transitionCandidatePracticeDraftToGeneratingMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            practiceDraftId: "draft-1",
        });
        expect(createCandidateSessionFromDraftMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            practiceDraftId: "draft-1",
        });
    });

    it("returns an editable-state error when the draft cannot transition", async () => {
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue({
            provider: "dev_mock",
            issuer: "interview-coach-local",
            subject: "candidate@example.com",
            email: "candidate@example.com",
            workspace: "local_dev",
        });
        resolveCandidateProfileFromIdentityMock.mockResolvedValue({
            candidateProfileId: "profile-1",
        });
        transitionCandidatePracticeDraftToGeneratingMock.mockResolvedValue(null);

        const { startPracticeGenerationAction } = await import("./actions");

        await expect(startPracticeGenerationAction("draft-other")).resolves.toEqual({
            ok: false,
            error: "Practice draft is no longer editable.",
        });
    });
});
