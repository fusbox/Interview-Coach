import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
});

describe("candidate dev auth resolver", () => {
    it("returns null when candidate auth mode is external", async () => {
        process.env = {
            NODE_ENV: "development",
            CANDIDATE_AUTH_MODE: "external",
        };

        const { resolveLocalCandidateAuthHandoff } = await import("./candidate-dev-auth-resolver");

        await expect(resolveLocalCandidateAuthHandoff()).resolves.toBeNull();
    });

    it("resolves a stable explicit mock candidate handoff", async () => {
        process.env = {
            NODE_ENV: "development",
            CANDIDATE_AUTH_MODE: "mock",
            CANDIDATE_MOCK_EMAIL: " Mock.Candidate@Example.com ",
            CANDIDATE_MOCK_DISPLAY_NAME: " Mock Candidate ",
        };

        const { resolveLocalCandidateAuthHandoff } = await import("./candidate-dev-auth-resolver");

        await expect(resolveLocalCandidateAuthHandoff()).resolves.toEqual({
            provider: "dev_mock",
            issuer: "interview-coach-local",
            subject: "mock.candidate@example.com",
            email: "mock.candidate@example.com",
            displayName: "Mock Candidate",
            workspace: "local_dev",
        });
    });

    it("resolves a password-backed dev handoff from explicit dev identity inputs", async () => {
        process.env = {
            NODE_ENV: "development",
            CANDIDATE_AUTH_MODE: "password",
            CANDIDATE_DEV_EMAIL: " Dev.Candidate@Example.com ",
            CANDIDATE_DEV_SUBJECT: " local-user-123 ",
            CANDIDATE_DEV_DISPLAY_NAME: " Dev Candidate ",
        };

        const { resolveLocalCandidateAuthHandoff } = await import("./candidate-dev-auth-resolver");

        await expect(resolveLocalCandidateAuthHandoff()).resolves.toEqual({
            provider: "password",
            issuer: "interview-coach-local",
            subject: "local-user-123",
            email: "dev.candidate@example.com",
            displayName: "Dev Candidate",
            workspace: "local_dev",
        });
    });

    it("resolves the seeded primary candidate in explicit dev mode without identity inputs", async () => {
        process.env = {
            NODE_ENV: "development",
            CANDIDATE_AUTH_MODE: "dev",
        };

        const { resolveLocalCandidateAuthHandoff } = await import("./candidate-dev-auth-resolver");

        await expect(resolveLocalCandidateAuthHandoff()).resolves.toEqual({
            provider: "password",
            issuer: "interview-coach-local",
            subject: "candidate-dev-primary@talentarbor.local",
            email: "candidate-dev-primary@talentarbor.local",
            displayName: "Dev Candidate Primary",
            workspace: "local_dev",
        });
    });

    it("resolves the Irma preview-test candidate only when preview auth is explicitly enabled", async () => {
        process.env = {
            NODE_ENV: "production",
            CANDIDATE_AUTH_MODE: "preview_test",
            VERCEL_ENV: "preview",
            ALLOW_CANDIDATE_PREVIEW_AUTH: "true",
        };

        const { resolveLocalCandidateAuthHandoff } = await import("./candidate-dev-auth-resolver");

        await expect(resolveLocalCandidateAuthHandoff()).resolves.toEqual({
            provider: "dev_mock",
            issuer: "interview-coach-preview",
            subject: "irma.castillo@talentarbor.local",
            email: "irma.castillo@talentarbor.local",
            displayName: "Irma Castillo",
            workspace: "local_dev",
        });
    });

    it("allows preview-test candidate identity overrides for branch-specific validation", async () => {
        process.env = {
            NODE_ENV: "production",
            CANDIDATE_AUTH_MODE: "preview_test",
            VERCEL_ENV: "preview",
            ALLOW_CANDIDATE_PREVIEW_AUTH: "true",
            CANDIDATE_PREVIEW_EMAIL: " Irma.Castillo+mobile@TalentArbor.Local ",
            CANDIDATE_PREVIEW_DISPLAY_NAME: " Irma Mobile ",
            CANDIDATE_PREVIEW_SUBJECT: " irma-preview-mobile ",
        };

        const { resolveLocalCandidateAuthHandoff } = await import("./candidate-dev-auth-resolver");

        await expect(resolveLocalCandidateAuthHandoff()).resolves.toEqual({
            provider: "dev_mock",
            issuer: "interview-coach-preview",
            subject: "irma-preview-mobile",
            email: "irma.castillo+mobile@talentarbor.local",
            displayName: "Irma Mobile",
            workspace: "local_dev",
        });
    });

    it("requires a dev email for password-backed dev auth", async () => {
        process.env = {
            NODE_ENV: "development",
            CANDIDATE_AUTH_MODE: "password",
        };

        const { resolveLocalCandidateAuthHandoff } = await import("./candidate-dev-auth-resolver");

        await expect(resolveLocalCandidateAuthHandoff()).rejects.toThrow(
            "CANDIDATE_DEV_EMAIL is required when CANDIDATE_AUTH_MODE=password."
        );
    });

    it("fails closed when dev, mock, or password mode is enabled in production", async () => {
        process.env = {
            NODE_ENV: "production",
            CANDIDATE_AUTH_MODE: "dev",
        };

        const { resolveLocalCandidateAuthHandoff } = await import("./candidate-dev-auth-resolver");

        await expect(resolveLocalCandidateAuthHandoff()).rejects.toThrow(
            "CANDIDATE_AUTH_MODE=dev is not allowed in production."
        );

        process.env.CANDIDATE_AUTH_MODE = "mock";
        await expect(resolveLocalCandidateAuthHandoff()).rejects.toThrow(
            "CANDIDATE_AUTH_MODE=mock is not allowed in production."
        );

        process.env.CANDIDATE_AUTH_MODE = "preview_test";
        await expect(resolveLocalCandidateAuthHandoff()).rejects.toThrow(
            "CANDIDATE_AUTH_MODE=preview_test requires VERCEL_ENV=preview and ALLOW_CANDIDATE_PREVIEW_AUTH=true."
        );
    });
});
