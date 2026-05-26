import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    createCandidatePracticeDraftMock,
    createCandidateSessionFromDraftMock,
    resolveCandidateProfileFromIdentityMock,
    resolveLocalCandidateAuthHandoffMock,
    transitionCandidatePracticeDraftToGeneratingMock,
    updateCandidatePracticeDraftIntakeMock,
    updateCandidatePracticeDraftSetupMock,
} = vi.hoisted(() => ({
    createCandidatePracticeDraftMock: vi.fn(),
    createCandidateSessionFromDraftMock: vi.fn(),
    resolveCandidateProfileFromIdentityMock: vi.fn(),
    resolveLocalCandidateAuthHandoffMock: vi.fn(),
    transitionCandidatePracticeDraftToGeneratingMock: vi.fn(),
    updateCandidatePracticeDraftIntakeMock: vi.fn(),
    updateCandidatePracticeDraftSetupMock: vi.fn(),
}));

vi.mock("@/lib/server/candidate/candidate-dev-auth-resolver", () => ({
    resolveLocalCandidateAuthHandoff: resolveLocalCandidateAuthHandoffMock,
}));

vi.mock("@/lib/server/candidate/candidate-profile-repository", () => ({
    resolveCandidateProfileFromIdentity: resolveCandidateProfileFromIdentityMock,
}));

vi.mock("@/lib/server/candidate/candidate-practice-draft-repository", () => ({
    createCandidatePracticeDraft: createCandidatePracticeDraftMock,
    transitionCandidatePracticeDraftToGenerating: transitionCandidatePracticeDraftToGeneratingMock,
    updateCandidatePracticeDraftIntake: updateCandidatePracticeDraftIntakeMock,
    updateCandidatePracticeDraftSetup: updateCandidatePracticeDraftSetupMock,
}));

vi.mock("@/lib/server/candidate/candidate-session-creation-service", () => ({
    createCandidateSessionFromDraft: createCandidateSessionFromDraftMock,
}));

describe("practice setup actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("saves the restored setup and intake before generating a session", async () => {
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
        updateCandidatePracticeDraftSetupMock.mockResolvedValue({
            practiceDraftId: "draft-1",
        });
        updateCandidatePracticeDraftIntakeMock.mockResolvedValue({
            practiceDraftId: "draft-1",
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

        await expect(startPracticeGenerationAction({
            practiceDraftId: "draft-1",
            setup: {
                targetRole: " QA analyst ",
                jobDescription: "Test regulated workflows.",
                resumeText: "Validated releases.",
                questionCount: 7,
            },
            intakeResponses: {
                confidenceLevel: "medium",
                interviewType: "behavioral",
                timeline: "Interview next week",
                concerns: "Staying concise",
                practiceFocus: ["structure", "examples"],
            },
        })).resolves.toEqual({
            ok: true,
            practiceDraftId: "draft-1",
            sessionId: "session-1",
            resumeTargetScreen: "session_entry",
        });
        expect(updateCandidatePracticeDraftSetupMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            practiceDraftId: "draft-1",
            targetRole: "QA analyst",
            jobDescription: "Test regulated workflows.",
            resumeText: "Validated releases.",
        });
        expect(updateCandidatePracticeDraftIntakeMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            practiceDraftId: "draft-1",
            intakeResponses: {
                confidenceLevel: "medium",
                interviewType: "behavioral",
                timeline: "Interview next week",
                concerns: "Staying concise",
                practiceFocus: ["structure", "examples"],
            },
        });
        expect(transitionCandidatePracticeDraftToGeneratingMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            practiceDraftId: "draft-1",
        });
        expect(createCandidateSessionFromDraftMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            practiceDraftId: "draft-1",
            generationConfig: {
                questionCount: 7,
            },
        });
    });

    it("creates a new draft when no editable draft was restored", async () => {
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
        createCandidatePracticeDraftMock.mockResolvedValue({
            practiceDraftId: "draft-new",
        });
        updateCandidatePracticeDraftIntakeMock.mockResolvedValue({
            practiceDraftId: "draft-new",
        });
        transitionCandidatePracticeDraftToGeneratingMock.mockResolvedValue({
            practiceDraftId: "draft-new",
            status: "generating",
            resumeTargetScreen: "practice_generating",
        });
        createCandidateSessionFromDraftMock.mockResolvedValue({
            ok: true,
            practiceDraftId: "draft-new",
            sessionId: "session-new",
            questionSetSnapshotId: "snapshot-new",
            resumeTargetScreen: "session_entry",
        });

        const { startPracticeGenerationAction } = await import("./actions");

        await expect(startPracticeGenerationAction({
            practiceDraftId: null,
            setup: {
                targetRole: "Customer Success Manager",
                jobDescription: null,
                resumeText: null,
                questionCount: 5,
            },
            intakeResponses: {
                confidenceLevel: null,
                interviewType: "general",
                timeline: null,
                concerns: null,
                practiceFocus: [],
            },
        })).resolves.toEqual({
            ok: true,
            practiceDraftId: "draft-new",
            sessionId: "session-new",
            resumeTargetScreen: "session_entry",
        });
        expect(createCandidatePracticeDraftMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            targetRole: "Customer Success Manager",
            jobDescription: null,
            resumeText: null,
        });
        expect(updateCandidatePracticeDraftSetupMock).not.toHaveBeenCalled();
    });

    it("returns a not-found style error when the draft is missing or not owned", async () => {
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

        updateCandidatePracticeDraftSetupMock.mockResolvedValue(null);

        await expect(startPracticeGenerationAction({
            practiceDraftId: "draft-other",
            setup: {
                targetRole: "QA analyst",
                jobDescription: null,
                resumeText: null,
                questionCount: 5,
            },
            intakeResponses: {
                confidenceLevel: null,
                interviewType: null,
                timeline: null,
                concerns: null,
                practiceFocus: [],
            },
        })).resolves.toEqual({
            ok: false,
            error: "Practice draft was not found.",
        });
    });
});
