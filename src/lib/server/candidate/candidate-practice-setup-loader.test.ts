import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    findLatestEditableCandidatePracticeDraftMock,
    resolveCandidateProfileFromIdentityMock,
    resolveLocalCandidateAuthHandoffMock,
} = vi.hoisted(() => ({
    findLatestEditableCandidatePracticeDraftMock: vi.fn(),
    resolveCandidateProfileFromIdentityMock: vi.fn(),
    resolveLocalCandidateAuthHandoffMock: vi.fn(),
}));

vi.mock("./candidate-dev-auth-resolver", () => ({
    resolveLocalCandidateAuthHandoff: resolveLocalCandidateAuthHandoffMock,
}));

vi.mock("./candidate-profile-repository", () => ({
    resolveCandidateProfileFromIdentity: resolveCandidateProfileFromIdentityMock,
}));

vi.mock("./candidate-practice-draft-repository", () => ({
    findLatestEditableCandidatePracticeDraft: findLatestEditableCandidatePracticeDraftMock,
}));

describe("candidate practice setup loader", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("loads the latest editable draft for the local candidate profile", async () => {
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue({
            provider: "dev_mock",
            issuer: "interview-coach-local",
            subject: "candidate@example.com",
            email: "candidate@example.com",
            displayName: "Candidate",
            workspace: "local_dev",
        });
        resolveCandidateProfileFromIdentityMock.mockResolvedValue({
            candidateProfileId: "profile-1",
        });
        findLatestEditableCandidatePracticeDraftMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            targetRole: "QA analyst",
            jobDescription: "Test regulated workflows.",
            resumeContext: {
                pastedText: "Validated releases.",
                extractedText: "Validated releases.",
                captureMode: "pasted_text",
            },
        });

        const { loadPracticeSetupDraftForCurrentCandidate } = await import("./candidate-practice-setup-loader");

        await expect(loadPracticeSetupDraftForCurrentCandidate()).resolves.toEqual({
            practiceDraftId: "draft-1",
            initialValues: {
                targetRole: "QA analyst",
                jobDescription: "Test regulated workflows.",
                resumeText: "Validated releases.",
            },
        });
        expect(findLatestEditableCandidatePracticeDraftMock).toHaveBeenCalledWith("profile-1");
    });

    it("returns null when there is no local candidate handoff yet", async () => {
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue(null);

        const { loadPracticeSetupDraftForCurrentCandidate } = await import("./candidate-practice-setup-loader");

        await expect(loadPracticeSetupDraftForCurrentCandidate()).resolves.toBeNull();
        expect(resolveCandidateProfileFromIdentityMock).not.toHaveBeenCalled();
        expect(findLatestEditableCandidatePracticeDraftMock).not.toHaveBeenCalled();
    });
});
