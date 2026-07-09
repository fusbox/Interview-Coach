import { createHmac } from "crypto";

import { describe, expect, it } from "vitest";

import {
    CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV,
    createCandidateProductionHostLaunchRouteDependencies,
} from "./production-host-launch-runtime";
import { CANDIDATE_HOST_LAUNCH_SECRET_ENV } from "./production-host-launch-verifier";

describe("production host launch runtime assembly", () => {
    const now = new Date("2026-07-08T17:00:00.000Z");

    it("does not assemble production dependencies without the launch secret", () => {
        expect(createCandidateProductionHostLaunchRouteDependencies({
            now,
            env: {
                [CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]: "postgresql://postgres:postgres@localhost:5432/postgres",
            },
        })).toBeNull();
    });

    it("does not assemble production dependencies without a database URL", () => {
        expect(createCandidateProductionHostLaunchRouteDependencies({
            now,
            env: {
                [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: "launch-secret",
            },
        })).toBeNull();
    });

    it("assembles a verifier and fail-closed placeholder context lookup when required config exists", async () => {
        const dependencies = createCandidateProductionHostLaunchRouteDependencies({
            now,
            env: {
                [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: "launch-secret",
                [CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]: "postgresql://postgres:postgres@localhost:5432/postgres",
            },
        });

        expect(dependencies).not.toBeNull();
        const token = signJwt({
            candidate_id: "12345",
            product: "interview-coach",
            email: "candidate@example.com",
            exp: "1783530000",
            job_collection_id: "555",
            source_surface: "TA_JOB_SEARCH",
            host_domain: "talentarbor.com",
        }, "launch-secret");

        await expect(dependencies?.verifyLaunchToken(token)).resolves.toMatchObject({
            email: "candidate@example.com",
            jobCollectionId: "555",
        });

        await expect(dependencies?.resolveCandidateProfile({
            provider: "talentarbor_launch",
            issuer: "talentarbor",
            subject: "candidate:12345",
            email: "candidate@example.com",
            displayName: null,
            workspace: "talentarbor",
            externalIds: {
                hostCandidateId: "12345",
                hostUserId: null,
                talentArborId: "12345",
                rangamWorksId: null,
            },
            launchContextHint: {
                candidateId: "12345",
                jobCollectionId: "555",
                hostDomain: "talentarbor.com",
                sourceSurface: "TA_JOB_SEARCH",
            },
        }, {
            expiresAt: "2026-07-15T17:00:00.000Z",
            issuedAt: null,
        })).resolves.toBeNull();
    });
});

function signJwt(claims: Record<string, unknown>, secret: string) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const signingInput = `${header}.${payload}`;
    const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");

    return `${signingInput}.${signature}`;
}
