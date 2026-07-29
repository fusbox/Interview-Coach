import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { CANDIDATE_APP_SESSION_COOKIE } from "@/features/candidate-auth-v2/candidate-route-access";
import { resolveCandidateSetupRouteIdentity } from "./candidate-setup-route-identity";

describe("candidate setup route identity", () => {
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
});
