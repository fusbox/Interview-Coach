import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CANDIDATE_APP_SESSION_COOKIE } from "@/features/candidate-auth-v2/candidate-route-access";
import { resolveCandidateSetupRouteIdentity } from "./candidate-setup-route-identity";

describe("candidate setup route identity", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("derives an app-owned setup owner without consulting host setup staging", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{
                user_id: "11111111-1111-4111-8111-111111111111",
                candidate_profile_id: "22222222-2222-4222-8222-222222222222",
            }],
        });
        const request = new Request("http://localhost/candidate/setup/resume-text", {
            headers: {
                cookie: `${CANDIDATE_APP_SESSION_COOKIE}=candidate-session`,
            },
        });

        await expect(resolveCandidateSetupRouteIdentity(request, { query })).resolves.toEqual({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            setupOwnerKey: "candidate:22222222-2222-4222-8222-222222222222",
            accessSource: "app_account",
            candidateLaunchSessionId: null,
            trustedSetupContext: null,
        });
        expect(query).toHaveBeenCalledTimes(1);
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("profile.workspace = 'interview_coach'"),
            [createHash("sha256").update("candidate-session").digest("hex")],
        );
        expect(query.mock.calls[0][0]).not.toContain("candidate_launch_setup_contexts");
    });

    it("does not project a local dev fixture key as a durable launch-session UUID", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");
        const query = vi.fn();
        const request = new Request("http://localhost/candidate/setup/start", {
            headers: {
                cookie: "ic_candidate_launch_session=dev-host-launch-100002",
            },
        });

        await expect(resolveCandidateSetupRouteIdentity(request, { query })).resolves.toEqual({
            candidateProfileId: "10000000-0000-4000-8000-000000000002",
            setupOwnerKey: "candidate:10000000-0000-4000-8000-000000000002",
            accessSource: "dev_host_launch",
            candidateLaunchSessionId: null,
            trustedSetupContext: null,
        });
        expect(query).not.toHaveBeenCalled();
    });

    it("preserves the database-owned UUID for a verified production host launch", async () => {
        const candidateProfileId = "33333333-3333-4333-8333-333333333333";
        const candidateLaunchSessionId = "44444444-4444-4444-8444-444444444444";
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ candidate_profile_id: candidateProfileId }] })
            .mockResolvedValueOnce({
                rows: [{
                    candidate_profile_id: candidateProfileId,
                    launch_job_collection_id: null,
                    setup_context_consumed_at: null,
                }],
            });
        const request = new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
            headers: {
                cookie: `ic_candidate_launch_session=${candidateLaunchSessionId}`,
            },
        });

        await expect(resolveCandidateSetupRouteIdentity(request, { query })).resolves.toEqual({
            candidateProfileId,
            setupOwnerKey: `candidate:${candidateProfileId}`,
            accessSource: "host_launch",
            candidateLaunchSessionId,
            trustedSetupContext: null,
        });
        expect(query).toHaveBeenCalledTimes(2);
    });
});
