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

    it("fails closed when mock or password mode is enabled in production", async () => {
        process.env = {
            NODE_ENV: "production",
            CANDIDATE_AUTH_MODE: "mock",
        };

        const { resolveLocalCandidateAuthHandoff } = await import("./candidate-dev-auth-resolver");

        await expect(resolveLocalCandidateAuthHandoff()).rejects.toThrow(
            "CANDIDATE_AUTH_MODE=mock is not allowed in production."
        );
    });
});
