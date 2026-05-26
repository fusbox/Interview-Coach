import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    queryPostgresMock,
} = vi.hoisted(() => ({
    queryPostgresMock: vi.fn(),
}));

vi.mock("@/lib/server/db/postgres", () => ({
    queryPostgres: queryPostgresMock,
}));

describe("candidate profile repository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("finds a candidate profile by provider identity", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [{
                candidate_profile_id: "profile-1",
                auth_subject: "talentarbor_login:talentarbor:user-123",
                email: "candidate@example.com",
                display_name: "Candidate One",
                workspace: "talentarbor",
                provider: "talentarbor_login",
                issuer: "talentarbor",
                subject: "user-123",
            }],
        });

        const { findCandidateProfileByIdentity } = await import("./candidate-profile-repository");

        await expect(findCandidateProfileByIdentity({
            provider: "talentarbor_login",
            issuer: "talentarbor",
            subject: "user-123",
        })).resolves.toEqual({
            candidateProfileId: "profile-1",
            authSubject: "talentarbor_login:talentarbor:user-123",
            email: "candidate@example.com",
            displayName: "Candidate One",
            workspace: "talentarbor",
            provider: "talentarbor_login",
            issuer: "talentarbor",
            subject: "user-123",
        });
        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("from public.candidate_identities i"),
            ["talentarbor_login", "talentarbor", "user-123"]
        );
    });

    it("returns null when no candidate identity exists", async () => {
        queryPostgresMock.mockResolvedValue({ rows: [] });

        const { findCandidateProfileByIdentity } = await import("./candidate-profile-repository");

        await expect(findCandidateProfileByIdentity({
            provider: "dev_mock",
            issuer: "interview-coach-local",
            subject: "missing@example.invalid",
        })).resolves.toBeNull();
    });

    it("resolves or creates a candidate profile from an identity handoff", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [{
                candidate_profile_id: "profile-2",
                auth_subject: "rangamworks_sso:rangamworks:rw-456",
                email: "worker@example.com",
                display_name: "Worker Bee",
                workspace: "rangamworks",
                provider: "rangamworks_sso",
                issuer: "rangamworks",
                subject: "rw-456",
            }],
        });

        const { resolveCandidateProfileFromIdentity } = await import("./candidate-profile-repository");

        await expect(resolveCandidateProfileFromIdentity({
            provider: "rangamworks_sso",
            issuer: "rangamworks",
            subject: "rw-456",
            email: "Worker@Example.com ",
            displayName: "Worker Bee",
            workspace: "rangamworks",
        })).resolves.toMatchObject({
            candidateProfileId: "profile-2",
            authSubject: "rangamworks_sso:rangamworks:rw-456",
            email: "worker@example.com",
            provider: "rangamworks_sso",
        });
        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("on conflict (auth_subject)"),
            [
                "rangamworks_sso:rangamworks:rw-456",
                "worker@example.com",
                "Worker Bee",
                "rangamworks",
                "rangamworks_sso",
                "rangamworks",
                "rw-456",
            ]
        );
    });

    it("rejects blank identity values before querying", async () => {
        const { resolveCandidateProfileFromIdentity } = await import("./candidate-profile-repository");

        await expect(resolveCandidateProfileFromIdentity({
            provider: "password",
            issuer: "interview-coach-local",
            subject: " ",
            email: "candidate@example.com",
            workspace: "local_dev",
        })).rejects.toThrow("Candidate identity subject is required.");
        expect(queryPostgresMock).not.toHaveBeenCalled();
    });
});
