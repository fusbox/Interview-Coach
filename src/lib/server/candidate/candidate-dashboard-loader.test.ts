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
        queryPostgresMock
            .mockResolvedValueOnce({
                rows: [
                {
                    practice_draft_id: "draft-1",
                    role_profile_id: "role-profile-1",
                    role_profile_source: "manual",
                    target_role: "QA Analyst",
                    job_description: "QA Analyst role requiring clear bug reports and release judgment.",
                    resume_context_json: { processedArtifact: { text: "Manual testing and release notes experience." } },
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
                    role_profile_id: null,
                    role_profile_source: null,
                    target_role: "QA Analyst",
                    job_description: "QA Analyst role requiring customer communication.",
                    resume_context_json: { processedArtifact: null, extractedText: "" },
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
            })
            .mockResolvedValueOnce({
                rows: [
                    {
                        session_id: "session-2",
                        question_id: "question-1",
                        question_index: 0,
                        question_text: "Tell me about a time you handled a difficult customer.",
                        category: "behavioral",
                        answer_id: "answer-1",
                        modality: "text",
                        final_text: "I listened, clarified the issue, and followed up with a fix.",
                        submitted_at: "2026-05-11T14:05:00.000Z",
                        feedback_json: {
                            feedbackPlan: {
                                centralRead: "The answer shows calm customer handling.",
                                signal: { valence: "strength", detectability: "clear" },
                                primaryAnchor: {
                                    source: "content",
                                    signalType: "behavior",
                                    dimension: "focus_relevance",
                                    candidateEvidence: "I listened and clarified the issue.",
                                    interviewerValue: "Shows service judgment.",
                                },
                                intervention: {
                                    type: "amplify_strength",
                                    reason: "Add the business result next time.",
                                },
                            },
                            contentPulse: {
                                dimension: "outcome_explicitness",
                                headline: "Show what changed",
                                body: "Add the measurable customer or team result.",
                            },
                            recommendation: "Add a measurable outcome to your next answer.",
                        },
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
                    roleProfileId: "role-profile-1",
                    roleContextLabel: "Role context saved",
                    title: "QA Analyst",
                    href: "/session/session-1",
                    progressLabel: "1 of 3 answered",
                },
            ],
            completedItems: [
                {
                    practiceDraftId: "draft-2",
                    title: "QA Analyst",
                    href: "/summary/session-2",
                    summarySnippet: "Clearer answers and stronger examples.",
                    prepProfile: {
                        prepProfileId: "draft-2",
                        signals: expect.arrayContaining([
                            expect.objectContaining({
                                signalId: "content:outcome_explicitness",
                                label: "Show what changed",
                                lane: "answer_substance",
                                evidenceState: "strong",
                            }),
                        ]),
                        recommendation: {
                            label: "Keep building interview preparedness",
                            source: "session_summary",
                        },
                        signalCounts: {
                            strong: 3,
                        },
                    },
                },
            ],
            nextBestAction: {
                title: "Resume QA Analyst",
                body: "You have 1 of 3 answered. Pick up this active practice before starting another round.",
                href: "/session/session-1",
                actionLabel: "Resume practice",
            },
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(expect.stringContaining("where d.candidate_profile_id = $1"), ["profile-1"]);
        expect(queryPostgresMock.mock.calls[0][0]).toContain("d.role_profile_id");
        expect(queryPostgresMock.mock.calls[0][0]).toContain("public.candidate_role_preparation_profiles");
        expect(queryPostgresMock.mock.calls[1][0]).toContain("from public.questions q");
        expect(queryPostgresMock.mock.calls[1][1]).toEqual([["session-1", "session-2"]]);
        expect(withCandidateRouteMetricsMock).toHaveBeenCalledWith(expect.objectContaining({
            route: "/dashboard",
            operation: "load_dashboard",
        }));
    });

    it("filters dashboard rows to the selected target interview context", async () => {
        queryPostgresMock
            .mockResolvedValueOnce({
                rows: [
                    {
                        practice_draft_id: "client-service-latest",
                        role_profile_id: "client-service-profile",
                        role_profile_source: "practice_setup",
                        target_role: "Client Service Coordinator",
                        job_description: "Coordinate client service operations.",
                        resume_context_json: { processedArtifact: { text: "Client service experience." } },
                        status: "completed",
                        resume_target_screen: "session_summary",
                        session_id: "client-service-session",
                        session_status: "COMPLETED",
                        current_question_index: 3,
                        question_count: 3,
                        submitted_count: 3,
                        summary_narrative: "Strong client service practice.",
                        latest_recommendation: null,
                        latest_one_big_upgrade: null,
                        last_activity_at: "2026-05-13T14:00:00.000Z",
                    },
                    {
                        practice_draft_id: "technical-support-older",
                        role_profile_id: "technical-support-profile",
                        role_profile_source: "practice_setup",
                        target_role: "Technical Support Specialist",
                        job_description: "Troubleshoot technical customer issues.",
                        resume_context_json: { processedArtifact: { text: "Support experience." } },
                        status: "completed",
                        resume_target_screen: "session_summary",
                        session_id: "technical-support-session",
                        session_status: "COMPLETED",
                        current_question_index: 3,
                        question_count: 3,
                        submitted_count: 3,
                        summary_narrative: "Technical support practice.",
                        latest_recommendation: null,
                        latest_one_big_upgrade: null,
                        last_activity_at: "2026-05-12T14:00:00.000Z",
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [] });
        const { loadCandidateDashboardForCurrentCandidate } = await import("./candidate-dashboard-loader");

        await expect(loadCandidateDashboardForCurrentCandidate()).resolves.toMatchObject({
            stats: {
                activeCount: 0,
                completedCount: 1,
                totalPracticeCount: 1,
            },
            completedItems: [
                {
                    practiceDraftId: "client-service-latest",
                    title: "Client Service Coordinator",
                },
            ],
        });

        expect(queryPostgresMock.mock.calls[1][1]).toEqual([["client-service-session"]]);
    });

    it("uses the requested target role when it matches a candidate interview context", async () => {
        queryPostgresMock
            .mockResolvedValueOnce({
                rows: [
                    {
                        practice_draft_id: "client-service-latest",
                        role_profile_id: "client-service-profile",
                        role_profile_source: "practice_setup",
                        target_role: "Client Service Coordinator",
                        job_description: "Coordinate client service operations.",
                        resume_context_json: { processedArtifact: { text: "Client service experience." } },
                        status: "completed",
                        resume_target_screen: "session_summary",
                        session_id: "client-service-session",
                        session_status: "COMPLETED",
                        current_question_index: 3,
                        question_count: 3,
                        submitted_count: 3,
                        summary_narrative: "Strong client service practice.",
                        latest_recommendation: null,
                        latest_one_big_upgrade: null,
                        last_activity_at: "2026-05-13T14:00:00.000Z",
                    },
                    {
                        practice_draft_id: "technical-support-older",
                        role_profile_id: "technical-support-profile",
                        role_profile_source: "practice_setup",
                        target_role: "Technical Support Specialist",
                        job_description: "Troubleshoot technical customer issues.",
                        resume_context_json: { processedArtifact: { text: "Support experience." } },
                        status: "completed",
                        resume_target_screen: "session_summary",
                        session_id: "technical-support-session",
                        session_status: "COMPLETED",
                        current_question_index: 3,
                        question_count: 3,
                        submitted_count: 3,
                        summary_narrative: "Technical support practice.",
                        latest_recommendation: null,
                        latest_one_big_upgrade: null,
                        last_activity_at: "2026-05-12T14:00:00.000Z",
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [] });
        const { loadCandidateDashboardForCurrentCandidate } = await import("./candidate-dashboard-loader");

        await expect(loadCandidateDashboardForCurrentCandidate({
            targetRole: "Technical Support Specialist",
        })).resolves.toMatchObject({
            selectedTargetInterviewId: "technical support specialist",
            targetInterviews: expect.arrayContaining([
                expect.objectContaining({
                    label: "Client Service Coordinator",
                    isSelected: false,
                }),
                expect.objectContaining({
                    label: "Technical Support Specialist",
                    isSelected: true,
                }),
            ]),
            completedItems: [
                {
                    practiceDraftId: "technical-support-older",
                    title: "Technical Support Specialist",
                },
            ],
        });

        expect(queryPostgresMock.mock.calls[1][1]).toEqual([["technical-support-session"]]);
    });

    it("keeps older dashboard rows readable when no role profile link exists", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [
                {
                    practice_draft_id: "legacy-draft",
                    role_profile_id: null,
                    role_profile_source: null,
                    target_role: "Operations Clerk",
                    status: "completed",
                    resume_target_screen: "session_summary",
                    session_id: "legacy-session",
                    session_status: "COMPLETED",
                    current_question_index: 3,
                    question_count: 3,
                    submitted_count: 3,
                    summary_narrative: "Good structure with room for more detail.",
                    latest_recommendation: null,
                    latest_one_big_upgrade: null,
                    last_activity_at: "2026-05-10T14:00:00.000Z",
                },
            ],
        });
        const { loadCandidateDashboardForCurrentCandidate } = await import("./candidate-dashboard-loader");

        await expect(loadCandidateDashboardForCurrentCandidate()).resolves.toMatchObject({
            completedItems: [
                {
                    practiceDraftId: "legacy-draft",
                    roleProfileId: null,
                    roleContextLabel: "Role context from practice history",
                    title: "Operations Clerk",
                    href: "/summary/legacy-session",
                },
            ],
        });
    });

    it("grounds the next practice recommendation in completed feedback when no active session exists", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [
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
                    latest_recommendation: "Add a measurable outcome to your next answer.",
                    last_activity_at: "2026-05-11T14:00:00.000Z",
                },
            ],
        });
        const { loadCandidateDashboardForCurrentCandidate } = await import("./candidate-dashboard-loader");

        await expect(loadCandidateDashboardForCurrentCandidate()).resolves.toMatchObject({
            nextBestAction: {
                title: "Practice one focused improvement",
                body: "From your Support Lead summary: Add a measurable outcome to your next answer.",
                href: "/practice",
                actionLabel: "Practice again",
            },
        });

        expect(queryPostgresMock.mock.calls[0][0]).toContain("latest_recommendation");
        expect(queryPostgresMock.mock.calls[0][0]).toContain("public.eval_results");
    });

    it("prefers the latest one big upgrade when building dashboard coaching guidance", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [
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
                    latest_recommendation: "Add a measurable outcome to your next answer.",
                    latest_one_big_upgrade: {
                        focus: "Lead with the result",
                        rationale: "The action is clear, but the outcome needs to show why it mattered.",
                        targetMoment: "I helped the team",
                        trySayingThis: "I helped the team finish early, which kept the customer handoff on schedule.",
                    },
                    last_activity_at: "2026-05-11T14:00:00.000Z",
                },
            ],
        });
        const { loadCandidateDashboardForCurrentCandidate } = await import("./candidate-dashboard-loader");

        await expect(loadCandidateDashboardForCurrentCandidate()).resolves.toMatchObject({
            completedItems: [
                {
                    coachingSnippetLabel: "For the biggest lift",
                    coachingSnippet: "Lead with the result: I helped the team finish early, which kept the customer handoff on schedule.",
                },
            ],
            nextBestAction: {
                title: "Practice the biggest lift",
                body: "From your Support Lead feedback: Lead with the result. Try: I helped the team finish early, which kept the customer handoff on schedule.",
            },
        });

        expect(queryPostgresMock.mock.calls[0][0]).toContain("latest_one_big_upgrade");
    });
});
