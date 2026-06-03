import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    queryPostgresMock,
} = vi.hoisted(() => ({
    queryPostgresMock: vi.fn(),
}));

vi.mock("@/lib/server/db/postgres", () => ({
    queryPostgres: queryPostgresMock,
}));

describe("candidate role profile repository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("resolves or creates a role preparation profile from candidate role and required JD context", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [roleProfileRow({
                role_profile_id: "role-profile-1",
                candidate_profile_id: "profile-1",
                target_role: "Customer Success Manager",
                normalized_target_role: "customer success manager",
                job_description_snapshot: "Own renewals and customer health.",
                job_description_hash: sha256("Own renewals and customer health."),
            })],
        });

        const { resolveCandidateRolePreparationProfile } = await import("./candidate-role-profile-repository");

        await expect(resolveCandidateRolePreparationProfile({
            candidateProfileId: "profile-1",
            targetRole: " Customer   Success Manager ",
            jobDescription: " Own renewals and customer health. ",
            resumeContext: {
                captureMode: "pasted_text",
                extractedText: "Managed customer renewals.",
            },
            source: "manual",
        })).resolves.toMatchObject({
            roleProfileId: "role-profile-1",
            candidateProfileId: "profile-1",
            targetRole: "Customer Success Manager",
            normalizedTargetRole: "customer success manager",
            jobDescriptionSnapshot: "Own renewals and customer health.",
            jobDescriptionHash: sha256("Own renewals and customer health."),
            source: "manual",
            status: "active",
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("insert into public.candidate_role_preparation_profiles"),
            [
                "profile-1",
                "Customer Success Manager",
                "customer success manager",
                "Own renewals and customer health.",
                sha256("Own renewals and customer health."),
                {
                    captureMode: "pasted_text",
                    extractedText: "Managed customer renewals.",
                },
                "manual",
            ],
        );
        expect(queryPostgresMock.mock.calls[0][0]).toContain("where candidate_profile_id = $1");
        expect(queryPostgresMock.mock.calls[0][0]).toContain("status in ('active', 'paused')");
    });

    it("rejects missing job description context before writing", async () => {
        const { resolveCandidateRolePreparationProfile } = await import("./candidate-role-profile-repository");

        await expect(resolveCandidateRolePreparationProfile({
            candidateProfileId: "profile-1",
            targetRole: "Customer Success Manager",
            jobDescription: " ",
            resumeContext: null,
            source: "manual",
        })).rejects.toThrow("Candidate role profile requires target role and job description context.");

        expect(queryPostgresMock).not.toHaveBeenCalled();
    });
});

function roleProfileRow(overrides: Record<string, unknown>) {
    return {
        role_profile_id: "role-profile-id",
        candidate_profile_id: "profile-id",
        target_role: "Target role",
        normalized_target_role: "target role",
        job_description_snapshot: "Job description.",
        job_description_hash: sha256("Job description."),
        resume_context_snapshot_json: null,
        source: "manual",
        status: "active",
        last_practiced_at: null,
        created_at: "2026-05-12T10:00:00.000Z",
        updated_at: "2026-05-12T10:00:00.000Z",
        ...overrides,
    };
}

function sha256(value: string) {
    return createHash("sha256").update(value).digest("hex");
}
