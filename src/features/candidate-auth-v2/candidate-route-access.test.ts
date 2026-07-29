import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    CANDIDATE_APP_SESSION_COOKIE,
    resolveCandidateRouteAccess,
} from "./candidate-route-access";

describe("candidate route access", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("resolves an active candidate account through its app-user profile binding", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{
                user_id: "11111111-1111-4111-8111-111111111111",
                candidate_profile_id: "22222222-2222-4222-8222-222222222222",
            }],
        });

        await expect(resolveCandidateRouteAccess(
            `${CANDIDATE_APP_SESSION_COOKIE}=candidate-session-token`,
            { query },
        )).resolves.toEqual({
            source: "app_account",
            appUserId: "11111111-1111-4111-8111-111111111111",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
        });
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("app_role.role = 'candidate'"),
            [createHash("sha256").update("candidate-session-token").digest("hex")],
        );
        expect(query.mock.calls[0][0]).toContain("profile.workspace = 'interview_coach'");
        expect(query.mock.calls[0][0]).toContain("app_user.email_verified_at is not null");
    });

    it("fails closed without consulting host access when a candidate app cookie is present but invalid", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [] });

        await expect(resolveCandidateRouteAccess(
            `${CANDIDATE_APP_SESSION_COOKIE}=expired; ic_candidate_launch_session=host-session`,
            { query },
        )).resolves.toBeNull();
        expect(query).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0][0]).not.toContain("candidate_launch_sessions");
    });

    it.each([
        `${CANDIDATE_APP_SESSION_COOKIE}=`,
        `${CANDIDATE_APP_SESSION_COOKIE}=%E0%A4%A`,
    ])("treats a present empty or malformed app cookie as authoritative denial", async (candidateCookie) => {
        const query = vi.fn();

        await expect(resolveCandidateRouteAccess(
            `${candidateCookie}; ic_candidate_launch_session=host-session`,
            { query },
        )).resolves.toBeNull();
        expect(query).not.toHaveBeenCalled();
    });

    it("resolves a host session only to an unbound host candidate profile", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{ candidate_profile_id: "33333333-3333-4333-8333-333333333333" }],
        });

        await expect(resolveCandidateRouteAccess(
            "ic_candidate_launch_session=host-session",
            { query },
        )).resolves.toEqual({
            source: "host_launch",
            candidateProfileId: "33333333-3333-4333-8333-333333333333",
            candidateLaunchSessionId: "host-session",
        });
        expect(query.mock.calls[0][0]).toContain("profile.app_user_id is null");
    });

    it("preserves the explicit nonproduction host fixture path when no app account cookie exists", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");
        const query = vi.fn();

        await expect(resolveCandidateRouteAccess(
            "ic_candidate_launch_session=dev-host-launch-100001",
            { query },
        )).resolves.toEqual({
            source: "dev_host_launch",
            candidateProfileId: "10000000-0000-4000-8000-000000000001",
            candidateLaunchSessionId: "dev-host-launch-100001",
        });
        expect(query).not.toHaveBeenCalled();
    });
});
