import { describe, expect, it } from "vitest";

describe("candidate auth adapter contract", () => {
    it("normalizes a trusted provider handoff into profile resolution input", async () => {
        const { toCandidateProfileResolutionInput } = await import("./candidate-auth-adapter");

        expect(toCandidateProfileResolutionInput({
            provider: "talentarbor_login",
            issuer: " TalentArbor ",
            subject: " candidate-123 ",
            email: " Candidate@Example.com ",
            displayName: " Candidate One ",
            workspace: "talentarbor",
        })).toEqual({
            provider: "talentarbor_login",
            issuer: "TalentArbor",
            subject: "candidate-123",
            email: "candidate@example.com",
            displayName: "Candidate One",
            workspace: "talentarbor",
        });
    });

    it("allows adapters to resolve a nullable handoff from an unknown request source", async () => {
        const { createStaticCandidateAuthAdapter } = await import("./candidate-auth-adapter");
        const adapter = createStaticCandidateAuthAdapter({
            provider: "rangamworks_sso",
            issuer: "rangamworks",
            subject: "rw-456",
            email: "worker@example.com",
            displayName: null,
            workspace: "rangamworks",
        });

        await expect(adapter.resolveIdentity()).resolves.toEqual({
            provider: "rangamworks_sso",
            issuer: "rangamworks",
            subject: "rw-456",
            email: "worker@example.com",
            displayName: null,
            workspace: "rangamworks",
        });

        expect(adapter.source).toBe("static");
    });

    it("rejects blank required handoff fields before repository resolution", async () => {
        const { toCandidateProfileResolutionInput } = await import("./candidate-auth-adapter");

        expect(() => toCandidateProfileResolutionInput({
            provider: "password",
            issuer: "interview-coach-local",
            subject: "",
            email: "candidate@example.com",
            workspace: "local_dev",
        })).toThrow("Candidate auth handoff subject is required.");

        expect(() => toCandidateProfileResolutionInput({
            provider: "password",
            issuer: "interview-coach-local",
            subject: "local-candidate",
            email: " ",
            workspace: "local_dev",
        })).toThrow("Candidate auth handoff email is required.");
    });
});
