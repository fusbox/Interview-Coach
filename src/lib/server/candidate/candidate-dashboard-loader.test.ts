import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    queryPostgresMock,
    resolveCandidateProfileFromIdentityMock,
    resolveLocalCandidateAuthHandoffMock,
    withCandidateRouteMetricsMock,
} = vi.hoisted(() => ({
    queryPostgresMock: vi.fn(),
    resolveCandidateProfileFromIdentityMock: vi.fn(),
    resolveLocalCandidateAuthHandoffMock: vi.fn(),
    withCandidateRouteMetricsMock: vi.fn(async ({ load }) => load()),
}));

vi.mock("@/lib/server/db/postgres", () => ({
    queryPostgres: queryPostgresMock,
}));

vi.mock("./candidate-dev-auth-resolver", () => ({
    resolveLocalCandidateAuthHandoff: resolveLocalCandidateAuthHandoffMock,
}));

vi.mock("./candidate-profile-repository", () => ({
    resolveCandidateProfileFromIdentity: resolveCandidateProfileFromIdentityMock,
}));

vi.mock("./candidate-observability", () => ({
    withCandidateRouteMetrics: withCandidateRouteMetricsMock,
}));

describe("candidate dashboard loader", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue({
            provider: "dev_mock",
            issuer: "interview-coach-local",
            subject: "candidate@example.com",
            email: "candidate@example.com",
            displayName: "Candidate One",
            workspace: "local_dev",
        });
        resolveCandidateProfileFromIdentityMock.mockResolvedValue({
            candidateProfileId: "profile-1",
            email: "candidate@example.com",
            displayName: "Candidate One",
        });
    });

    it("returns null when no candidate auth handoff exists", async () => {
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue(null);
        const { loadCandidateDashboardForCurrentCandidate } = await import("./candidate-dashboard-loader");

        await expect(loadCandidateDashboardForCurrentCandidate()).resolves.toBeNull();
        expect(withCandidateRouteMetricsMock).toHaveBeenCalledWith(expect.objectContaining({
            route: "/dashboard",
            operation: "load_dashboard",
        }));
        expect(queryPostgresMock).not.toHaveBeenCalled();
    });

    it("loads candidate-scoped active and completed dashboard items", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [
                {
                    practice_draft_id: "draft-1",
                    target_role: "QA Analyst",
                    status: "in_session",
                    resume_target_screen: "session_in_progress",
                    session_id: "session-1",
                    session_status: "IN_SESSION",
                    current_question_index: 1,
                    question_count: 3,
                    submitted_count: 1,
                    summary_narrative: null,
                    last_activity_at: "2026-05-12T14:00:00.000Z",
                },
                {
                    practice_draft_id: "draft-2",
                    target_role: "Support Lead",
                    status: "completed",
                    resume_target_screen: "session_summary",
                    session_id: "session-2",
                    session_status: "COMPLETED",
                    current_question_index: 2,
                    question_count: 2,
                    submitted_count: 2,
                    summary_narrative: "Clearer answers and stronger examples.",
                    last_activity_at: "2026-05-11T14:00:00.000Z",
                },
            ],
        });
        const { loadCandidateDashboardForCurrentCandidate } = await import("./candidate-dashboard-loader");

        await expect(loadCandidateDashboardForCurrentCandidate()).resolves.toMatchObject({
            candidate: {
                candidateProfileId: "profile-1",
                displayName: "Candidate One",
            },
            stats: {
                activeCount: 1,
                completedCount: 1,
                totalPracticeCount: 2,
            },
            activeItems: [
                {
                    practiceDraftId: "draft-1",
                    title: "QA Analyst",
                    href: "/session/session-1",
                    progressLabel: "1 of 3 answered",
                },
            ],
            completedItems: [
                {
                    practiceDraftId: "draft-2",
                    title: "Support Lead",
                    href: "/summary/session-2",
                    summarySnippet: "Clearer answers and stronger examples.",
                },
            ],
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(expect.stringContaining("where d.candidate_profile_id = $1"), ["profile-1"]);
        expect(withCandidateRouteMetricsMock).toHaveBeenCalledWith(expect.objectContaining({
            route: "/dashboard",
            operation: "load_dashboard",
        }));
    });
});
