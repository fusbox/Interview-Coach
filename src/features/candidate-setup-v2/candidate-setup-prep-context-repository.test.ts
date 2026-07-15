import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
    createCandidateManualPrepContextKey,
    createCandidateSetupPrepContextRepository,
} from "./candidate-setup-prep-context-repository";

describe("candidate setup prep-context repository", () => {
    it("verifies an explicitly requested prep context belongs to the candidate", async () => {
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return { rows: [{ role_profile_id: "role-profile-1" }] };
        });
        const repository = createCandidateSetupPrepContextRepository({ query });

        await expect(repository.resolveSetupPrepContext({
            candidateProfileId: "candidate-1",
            requestedRoleProfileId: "role-profile-1",
            allowManualCreation: false,
            setupSnapshot: setupSnapshot(),
        })).resolves.toEqual({
            status: "resolved",
            roleProfileId: "role-profile-1",
            resolution: "requested",
        });

        expect(query.mock.calls[0][0]).toContain("where role_profile_id = $1");
        expect(query.mock.calls[0][0]).toContain("and candidate_profile_id = $2");
        expect(query.mock.calls[0][1]).toEqual(["role-profile-1", "candidate-1"]);
    });

    it("rejects an explicitly requested prep context that is not candidate-owned", async () => {
        const repository = createCandidateSetupPrepContextRepository({
            query: vi.fn(async () => ({ rows: [] })),
        });

        await expect(repository.resolveSetupPrepContext({
            candidateProfileId: "candidate-1",
            requestedRoleProfileId: "someone-elses-profile",
            allowManualCreation: false,
            setupSnapshot: setupSnapshot(),
        })).resolves.toBeNull();
    });

    it("does not create a manual context when the identity boundary forbids it", async () => {
        const query = vi.fn();
        const repository = createCandidateSetupPrepContextRepository({ query });

        await expect(repository.resolveSetupPrepContext({
            candidateProfileId: "candidate-1",
            allowManualCreation: false,
            setupSnapshot: setupSnapshot(),
        })).resolves.toBeNull();
        expect(query).not.toHaveBeenCalled();
    });

    it("returns every used exact-match path instead of silently reusing one", async () => {
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return { rows: [
                matchRow({
                    role_profile_id: "role-profile-newer",
                    created_at: "2026-07-12T12:00:00.000Z",
                    last_practice_activity_at: "2026-07-15T12:00:00.000Z",
                    completed_session_count: "2",
                    completed_question_count: "8",
                    active_completed_question_count: 2,
                    active_total_question_count: 5,
                }),
                matchRow({
                    role_profile_id: "role-profile-older",
                    created_at: "2026-07-01T12:00:00.000Z",
                    last_practice_activity_at: "2026-07-10T12:00:00.000Z",
                    completed_session_count: "1",
                    completed_question_count: "5",
                    active_completed_question_count: null,
                    active_total_question_count: null,
                }),
            ] };
        });
        const repository = createCandidateSetupPrepContextRepository({ query });

        await expect(repository.resolveSetupPrepContext({
            candidateProfileId: "candidate-1",
            allowManualCreation: true,
            setupSnapshot: setupSnapshot(),
        })).resolves.toEqual({
            status: "existing_paths",
            existingPrepContexts: [
                expect.objectContaining({
                    roleProfileId: "role-profile-newer",
                    targetRole: "Customer service representative",
                    interviewStage: "first_interview",
                    questionCount: 7,
                    completedSessionCount: 2,
                    completedQuestionCount: 8,
                    activeRound: {
                        completedQuestionCount: 2,
                        totalQuestionCount: 5,
                    },
                }),
                expect.objectContaining({
                    roleProfileId: "role-profile-older",
                    activeRound: null,
                }),
            ],
        });

        expect(query.mock.calls[0][0]).toContain("candidate_practice_sessions");
        expect(query.mock.calls[0][0]).toContain("profile.candidate_profile_id = $1");
        expect(query.mock.calls[0][1]).toEqual([
            "candidate-1",
            "customer service representative",
            sha256("Help customers resolve service questions."),
        ]);
    });

    it("reuses an exact-match profile only when it has no session activity", async () => {
        const query = vi.fn(async () => ({
            rows: [matchRow({
                role_profile_id: "empty-role-profile",
                session_count: 0,
                last_practice_activity_at: null,
                interview_stage: null,
                question_count: null,
            })],
        }));
        const repository = createCandidateSetupPrepContextRepository({ query });

        await expect(repository.resolveSetupPrepContext({
            candidateProfileId: "candidate-1",
            allowManualCreation: true,
            setupSnapshot: setupSnapshot(),
        })).resolves.toEqual({
            status: "resolved",
            roleProfileId: "empty-role-profile",
            resolution: "reused_empty",
        });
        expect(query).toHaveBeenCalledTimes(1);
    });

    it("creates path one when no exact candidate-owned match exists", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ role_profile_id: "created-role-profile" }] });
        const repository = createCandidateSetupPrepContextRepository({ query });

        await expect(repository.resolveSetupPrepContext({
            candidateProfileId: " candidate-1 ",
            allowManualCreation: true,
            setupSnapshot: setupSnapshot({
                targetRole: " Packaging   Associate ",
                jobDescription: " Pack finished goods.\nLabel cartons. ",
                resumeText: "Handled production materials.",
                resumeCaptureMode: "pasted_text",
            }),
        })).resolves.toEqual({
            status: "resolved",
            roleProfileId: "created-role-profile",
            resolution: "created",
        });

        expect(query.mock.calls[1][0]).toContain("practice_path_number");
        expect(query.mock.calls[1][0]).toContain("on conflict do nothing");
        expect(query.mock.calls[1][1]).toEqual([
            "candidate-1",
            "Packaging Associate",
            "packaging associate",
            "Pack finished goods. Label cartons.",
            sha256("Pack finished goods. Label cartons."),
            JSON.stringify({ included: true, captureMode: "pasted_text" }),
            1,
        ]);
    });

    it("turns a concurrent used first-path winner into an explicit choice", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [matchRow({ role_profile_id: "concurrent-used-profile" })] });
        const repository = createCandidateSetupPrepContextRepository({ query });

        await expect(repository.resolveSetupPrepContext({
            candidateProfileId: "candidate-1",
            allowManualCreation: true,
            setupSnapshot: setupSnapshot(),
        })).resolves.toEqual({
            status: "existing_paths",
            existingPrepContexts: [expect.objectContaining({ roleProfileId: "concurrent-used-profile" })],
        });
        expect(query).toHaveBeenCalledTimes(3);
    });

    it("creates a new role profile only after revalidating the chosen exact match", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [matchRow({ role_profile_id: "existing-profile" })] })
            .mockResolvedValueOnce({ rows: [{ role_profile_id: "separate-profile" }] });
        const repository = createCandidateSetupPrepContextRepository({ query });

        await expect(repository.resolveSetupPrepContext({
            candidateProfileId: "candidate-1",
            createSeparateFromRoleProfileId: "existing-profile",
            allowManualCreation: true,
            setupSnapshot: setupSnapshot(),
        })).resolves.toEqual({
            status: "resolved",
            roleProfileId: "separate-profile",
            resolution: "separate_created",
        });

        expect(query.mock.calls[1][0]).toContain("coalesce(max(profile.practice_path_number), 0) + 1");
        expect(query.mock.calls[1][0]).toContain("source_profile.role_profile_id = $7");
        expect(query.mock.calls[1][1][6]).toBe("existing-profile");
    });

    it("reuses an empty separate profile when session creation failed after the profile insert", async () => {
        const query = vi.fn(async () => ({
            rows: [
                matchRow({ role_profile_id: "existing-profile" }),
                matchRow({
                    role_profile_id: "incomplete-separate-profile",
                    session_count: 0,
                    last_practice_activity_at: null,
                    interview_stage: null,
                    question_count: null,
                }),
            ],
        }));
        const repository = createCandidateSetupPrepContextRepository({ query });

        await expect(repository.resolveSetupPrepContext({
            candidateProfileId: "candidate-1",
            createSeparateFromRoleProfileId: "existing-profile",
            allowManualCreation: true,
            setupSnapshot: setupSnapshot(),
        })).resolves.toEqual({
            status: "resolved",
            roleProfileId: "incomplete-separate-profile",
            resolution: "separate_reused_empty",
        });

        expect(query).toHaveBeenCalledTimes(1);
    });

    it("rejects a stale or unowned separate-path decision", async () => {
        const query = vi.fn(async () => ({ rows: [] }));
        const repository = createCandidateSetupPrepContextRepository({ query });

        await expect(repository.resolveSetupPrepContext({
            candidateProfileId: "candidate-1",
            createSeparateFromRoleProfileId: "unowned-profile",
            allowManualCreation: true,
            setupSnapshot: setupSnapshot(),
        })).resolves.toEqual({ status: "decision_invalid" });
        expect(query).toHaveBeenCalledTimes(1);
    });

    it("uses distinct manual keys for the same title with different job descriptions", () => {
        const first = createCandidateManualPrepContextKey({
            targetRole: "Material Handler",
            jobDescription: "Load trailers and scan inventory.",
        });
        const second = createCandidateManualPrepContextKey({
            targetRole: "Material Handler",
            jobDescription: "Move clean-room materials and verify batch labels.",
        });

        expect(first.normalizedTargetRole).toBe(second.normalizedTargetRole);
        expect(first.jobDescriptionHash).not.toBe(second.jobDescriptionHash);
    });

    it("normalizes inconsequential whitespace before deriving a manual key", () => {
        expect(createCandidateManualPrepContextKey({
            targetRole: " Customer   Service Representative ",
            jobDescription: " Help customers\nresolve service questions. ",
        })).toEqual(createCandidateManualPrepContextKey({
            targetRole: "Customer Service Representative",
            jobDescription: "Help customers resolve service questions.",
        }));
    });
});

function setupSnapshot(overrides: Record<string, unknown> = {}) {
    return {
        targetRole: "Customer service representative",
        jobDescription: "Help customers resolve service questions.",
        resumeText: null,
        interviewStage: "first_interview" as const,
        questionCount: 7,
        resumeCaptureMode: "none" as const,
        createdAt: "2026-07-14T20:00:00.000Z",
        ...overrides,
    };
}

function matchRow(overrides: Record<string, unknown> = {}) {
    return {
        role_profile_id: "role-profile-1",
        target_role: "Customer service representative",
        job_description_snapshot: "Help customers resolve service questions.",
        created_at: "2026-07-01T12:00:00.000Z",
        last_practice_activity_at: "2026-07-14T12:00:00.000Z",
        session_count: "1",
        completed_session_count: "1",
        completed_question_count: "5",
        interview_stage: "first_interview",
        question_count: "7",
        active_completed_question_count: null,
        active_total_question_count: null,
        ...overrides,
    };
}

function sha256(value: string) {
    return createHash("sha256").update(value).digest("hex");
}
