import { describe, expect, it, vi } from "vitest";

import { resolveCandidateDevHostLaunchCookieIdentity } from "./dev-host-launch-cookie-identity";

describe("dev host-launch cookie identity", () => {
    it("maps explicit local dev host-launch cookies to fixture candidate profile ids", () => {
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");

        expect(resolveCandidateDevHostLaunchCookieIdentity("ic_candidate_launch_session=dev-host-launch-100001")).toEqual({
            candidateProfileId: "10000000-0000-4000-8000-000000000001",
        });
    });

    it("does not resolve dev cookies when explicit dev host-launch mode is disabled", () => {
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "false");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");

        expect(resolveCandidateDevHostLaunchCookieIdentity("ic_candidate_launch_session=dev-host-launch-100001")).toBeNull();
    });
});
