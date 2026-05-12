import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    resolveCandidateProfileFromIdentityMock,
    resolveLocalCandidateAuthHandoffMock,
    transitionCandidatePracticeDraftToGeneratingMock,
} = vi.hoisted(() => ({
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

        const { startPracticeGenerationAction } = await import("./actions");

        await expect(startPracticeGenerationAction("draft-1")).resolves.toEqual({
            ok: true,
            practiceDraftId: "draft-1",
            resumeTargetScreen: "practice_generating",
        });
        expect(transitionCandidatePracticeDraftToGeneratingMock).toHaveBeenCalledWith({
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
