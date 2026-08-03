// @vitest-environment node

import { createHmac } from "crypto";

import { describe, expect, it, vi } from "vitest";

import {
    CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV,
    CANDIDATE_HOST_LAUNCH_SESSION_TTL_SECONDS_ENV,
    createCandidateProductionHostLaunchRouteDependencies,
} from "./production-host-launch-runtime";
import {
    CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE_ENV,
    CANDIDATE_HOST_LAUNCH_SECRET_ENV,
} from "./production-host-launch-verifier";
import {
    TA_SQL_DATABASE_ENV,
    TA_SQL_PASSWORD_ENV,
    TA_SQL_SERVER_ENV,
    TA_SQL_USER_ENV,
} from "./talentarbor-mssql-runtime";

describe("production host launch runtime assembly", () => {
    const now = new Date("2026-07-08T17:00:00.000Z");
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const secret = "launch-secret-that-is-at-least-32-bytes";
    const talentArborSqlEnv = {
        [TA_SQL_SERVER_ENV]: "ta-sql.internal",
        [TA_SQL_DATABASE_ENV]: "TalentArbor",
        [TA_SQL_USER_ENV]: "interview_coach_reader",
        [TA_SQL_PASSWORD_ENV]: "server-only-password",
    };

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
                [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: secret,
            },
        })).toBeNull();
    });

    it("does not assemble production dependencies without the complete TalentArbor SQL configuration", () => {
        expect(createCandidateProductionHostLaunchRouteDependencies({
            now,
            env: {
                [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: secret,
                [CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]: "postgresql://postgres:postgres@localhost:5432/postgres",
            },
        })).toBeNull();
    });

    it("assembles the verifier and injected TalentArbor lookup when all required config exists", async () => {
        const lookupLaunchContext = vi.fn(async () => null);
        const createTalentArborLookup = vi.fn(() => lookupLaunchContext);
        const dependencies = createCandidateProductionHostLaunchRouteDependencies({
            now,
            env: {
                ...talentArborSqlEnv,
                [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: secret,
                [CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]: "postgresql://postgres:postgres@localhost:5432/postgres",
            },
            createTalentArborLookup,
        });

        expect(dependencies).not.toBeNull();
        expect(createTalentArborLookup).toHaveBeenCalledWith(expect.objectContaining({
            server: "ta-sql.internal",
            database: "TalentArbor",
            password: "server-only-password",
        }));
        const token = signJwt({
            candidate_id: "12345",
            product: "interview-coach",
            email: "candidate@example.com",
            iss: "talentarbor",
            iat: nowSeconds,
            exp: nowSeconds + 120,
            job_collection_id: "555",
            source_surface: "TA_JOB_SEARCH",
            host_domain: "talentarbor.com",
        }, secret);

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
            requirementId: null,
            talentChannelId: null,
            clientId: null,
            hostDomain: "talentarbor.com",
            sourceSurface: "TA_JOB_SEARCH",
        },
        }, {
            launchTokenExpiresAt: "2026-07-08T17:02:00.000Z",
            issuedAt: "2026-07-08T17:00:00.000Z",
            tokenId: null,
            tokenFingerprint: "a".repeat(64),
            sessionExpiresAt: "2026-07-15T17:00:00.000Z",
        })).resolves.toEqual({
            ok: false,
            reason: "invalid_identity",
        });
        expect(lookupLaunchContext).toHaveBeenCalledWith({
            candidateId: "12345",
            jobCollectionId: "555",
            requirementId: null,
            talentChannelId: null,
            clientId: null,
            hostDomain: "talentarbor.com",
            sourceSurface: "TA_JOB_SEARCH",
        });
    });

    it("does not assemble production dependencies with an invalid app-session TTL", () => {
        expect(createCandidateProductionHostLaunchRouteDependencies({
            now,
            env: {
                ...talentArborSqlEnv,
                [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: secret,
                [CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]: "postgresql://postgres:postgres@localhost:5432/postgres",
                [CANDIDATE_HOST_LAUNCH_SESSION_TTL_SECONDS_ENV]: "604801",
            },
        })).toBeNull();
    });

    it("keeps RangamWorks production assembly fail-closed until its identity adapter is ratified", () => {
        expect(createCandidateProductionHostLaunchRouteDependencies({
            now,
            env: {
                ...talentArborSqlEnv,
                [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: secret,
                [CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE_ENV]: "rangamworks",
                [CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]: "postgresql://postgres:postgres@localhost:5432/postgres",
            },
        })).toBeNull();
    });
});

function signJwt(claims: Record<string, unknown>, secret: string) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const signingInput = `${header}.${payload}`;
    const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");

    return `${signingInput}.${signature}`;
}
