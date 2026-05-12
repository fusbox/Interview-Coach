import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    findCandidatePracticeDraftByIdMock,
    listEditableCandidatePracticeDraftSummariesMock,
    findLatestEditableCandidatePracticeDraftMock,
    resolveCandidateProfileFromIdentityMock,
    resolveLocalCandidateAuthHandoffMock,
} = vi.hoisted(() => ({
    findCandidatePracticeDraftByIdMock: vi.fn(),
    listEditableCandidatePracticeDraftSummariesMock: vi.fn(),
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
    findCandidatePracticeDraftById: findCandidatePracticeDraftByIdMock,
    findLatestEditableCandidatePracticeDraft: findLatestEditableCandidatePracticeDraftMock,
    listEditableCandidatePracticeDraftSummaries: listEditableCandidatePracticeDraftSummariesMock,
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
        listEditableCandidatePracticeDraftSummariesMock.mockResolvedValue([
            {
                practiceDraftId: "draft-1",
                draftLabel: "QA analyst",
                targetRole: "QA analyst",
                status: "draft",
                resumeTargetScreen: "practice_setup",
                lastActivityAt: "2026-05-12T12:00:00.000Z",
                createdAt: "2026-05-12T10:00:00.000Z",
            },
        ]);
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
            availableDrafts: [
                {
                    practiceDraftId: "draft-1",
                    draftLabel: "QA analyst",
                    targetRole: "QA analyst",
                    status: "draft",
                    resumeTargetScreen: "practice_setup",
                    lastActivityAt: "2026-05-12T12:00:00.000Z",
                    createdAt: "2026-05-12T10:00:00.000Z",
                },
            ],
            initialValues: {
                targetRole: "QA analyst",
                jobDescription: "Test regulated workflows.",
                resumeText: "Validated releases.",
            },
        });
        expect(findLatestEditableCandidatePracticeDraftMock).toHaveBeenCalledWith("profile-1");
        expect(listEditableCandidatePracticeDraftSummariesMock).toHaveBeenCalledWith("profile-1");
    });

    it("loads the selected candidate-owned draft when a draft id is provided", async () => {
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
        listEditableCandidatePracticeDraftSummariesMock.mockResolvedValue([
            {
                practiceDraftId: "draft-selected",
                draftLabel: "Warehouse lead",
                targetRole: "Warehouse lead",
                status: "draft",
                resumeTargetScreen: "practice_setup",
                lastActivityAt: "2026-05-11T12:00:00.000Z",
                createdAt: "2026-05-10T10:00:00.000Z",
            },
        ]);
        findCandidatePracticeDraftByIdMock.mockResolvedValue({
            practiceDraftId: "draft-selected",
            targetRole: "Warehouse lead",
            jobDescription: null,
            resumeContext: {
                pastedText: null,
                extractedText: "",
                captureMode: "none",
            },
        });

        const { loadPracticeSetupDraftForCurrentCandidate } = await import("./candidate-practice-setup-loader");

        await expect(loadPracticeSetupDraftForCurrentCandidate(" draft-selected ")).resolves.toMatchObject({
            practiceDraftId: "draft-selected",
            availableDrafts: [
                expect.objectContaining({
                    practiceDraftId: "draft-selected",
                    draftLabel: "Warehouse lead",
                }),
            ],
            initialValues: {
                targetRole: "Warehouse lead",
                jobDescription: null,
                resumeText: null,
            },
        });
        expect(findCandidatePracticeDraftByIdMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            practiceDraftId: "draft-selected",
        });
        expect(findLatestEditableCandidatePracticeDraftMock).not.toHaveBeenCalled();
    });

    it("returns null when there is no local candidate handoff yet", async () => {
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue(null);

        const { loadPracticeSetupDraftForCurrentCandidate } = await import("./candidate-practice-setup-loader");

        await expect(loadPracticeSetupDraftForCurrentCandidate()).resolves.toBeNull();
        expect(resolveCandidateProfileFromIdentityMock).not.toHaveBeenCalled();
        expect(findLatestEditableCandidatePracticeDraftMock).not.toHaveBeenCalled();
    });
});
