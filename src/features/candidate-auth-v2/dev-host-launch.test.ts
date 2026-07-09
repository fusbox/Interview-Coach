import { describe, expect, it } from "vitest";

import {
    CANDIDATE_HOST_LAUNCH_PRODUCT,
    type CandidateHostLaunchHandoff,
} from "./host-launch-contract";
import {
    CANDIDATE_DEV_HOST_LAUNCH_FIXTURES,
    isCandidateDevHostLaunchEnabled,
    mintCandidateDevHostLaunchToken,
    resolveCandidateDevHostLaunchProfile,
    verifyCandidateDevHostLaunchToken,
} from "./dev-host-launch";

describe("candidate dev host launch", () => {
    const secret = "local-dev-shared-secret";
    const now = new Date("2026-07-08T12:00:00.000Z");

    it("mints a host-shaped token for a fixture candidate and verifies it into the launch contract", async () => {
        const token = await mintCandidateDevHostLaunchToken({
            fixture: CANDIDATE_DEV_HOST_LAUNCH_FIXTURES.primary,
            secret,
            now,
        });

        const payload = await verifyCandidateDevHostLaunchToken({
            token,
            secret,
            now,
        });

        expect(payload).toEqual({
            issuer: "interview-coach-local-host",
            subject: "candidate:100001",
            email: "candidate-dev-primary@talentarbor.local",
            displayName: "Dev Candidate Primary",
            workspace: "talentarbor",
            product: CANDIDATE_HOST_LAUNCH_PRODUCT,
            expiresAt: "2026-07-15T12:00:00.000Z",
            hostCandidateId: "100001",
            hostUserId: null,
            issuedAt: "2026-07-08T12:00:00.000Z",
            rangamWorksId: null,
            talentArborId: "100001",
        });
    });

    it("rejects tampered tokens before candidate profile resolution", async () => {
        const token = await mintCandidateDevHostLaunchToken({
            fixture: CANDIDATE_DEV_HOST_LAUNCH_FIXTURES.primary,
            secret,
            now,
        });
        const tamperedToken = token.replace(/.$/, token.endsWith("a") ? "b" : "a");

        await expect(verifyCandidateDevHostLaunchToken({
            token: tamperedToken,
            secret,
            now,
        })).resolves.toBeNull();
    });

    it("rejects expired fixture tokens", async () => {
        const token = await mintCandidateDevHostLaunchToken({
            fixture: CANDIDATE_DEV_HOST_LAUNCH_FIXTURES.primary,
            secret,
            now,
            ttlSeconds: 1,
        });

        await expect(verifyCandidateDevHostLaunchToken({
            token,
            secret,
            now: new Date("2026-07-08T12:00:02.000Z"),
        })).resolves.toBeNull();
    });

    it("requires explicit non-production env and a secret before dev host launch is enabled", () => {
        expect(isCandidateDevHostLaunchEnabled({
            NODE_ENV: "development",
            CANDIDATE_HOST_LAUNCH_DEV_MODE: "true",
            CANDIDATE_HOST_LAUNCH_DEV_SECRET: secret,
        })).toBe(true);

        expect(isCandidateDevHostLaunchEnabled({
            NODE_ENV: "production",
            CANDIDATE_HOST_LAUNCH_DEV_MODE: "true",
            CANDIDATE_HOST_LAUNCH_DEV_SECRET: secret,
        })).toBe(false);

        expect(isCandidateDevHostLaunchEnabled({
            NODE_ENV: "development",
            CANDIDATE_HOST_LAUNCH_DEV_MODE: "true",
        })).toBe(false);
    });

    it("resolves fixture candidate ids to deterministic local profile sessions", async () => {
        const handoff: CandidateHostLaunchHandoff = {
            provider: "talentarbor_launch",
            issuer: "interview-coach-local-host",
            subject: "candidate:100002",
            email: "candidate-dev-alt@talentarbor.local",
            displayName: "Dev Candidate Alternate",
            workspace: "talentarbor",
            externalIds: {
                hostCandidateId: "100002",
                hostUserId: null,
                talentArborId: "100002",
                rangamWorksId: null,
            },
            launchContextHint: {
                candidateId: "100002",
                jobCollectionId: null,
                hostDomain: null,
                sourceSurface: "UNKNOWN",
            },
        };

        await expect(resolveCandidateDevHostLaunchProfile(handoff)).resolves.toEqual({
            candidateProfileId: "10000000-0000-4000-8000-000000000002",
            sessionId: "dev-host-launch-100002",
        });
    });
});
