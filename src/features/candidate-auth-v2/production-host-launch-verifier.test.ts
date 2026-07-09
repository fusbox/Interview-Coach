import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

import {
    CANDIDATE_HOST_LAUNCH_PRODUCT,
    type CandidateHostLaunchTokenPayload,
} from "./host-launch-contract";
import {
    CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS_ENV,
    CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER_ENV,
    CANDIDATE_HOST_LAUNCH_SECRET_ENV,
    createCandidateProductionHostLaunchVerifier,
    getCandidateProductionHostLaunchConfigStatus,
    verifyCandidateProductionHostLaunchToken,
} from "./production-host-launch-verifier";

describe("candidate production host launch verifier boundary", () => {
    const now = new Date("2026-07-08T12:00:00.000Z");
    const secret = "production-shared-secret";

    it("reports fail-closed configuration status when the shared secret is absent", () => {
        expect(getCandidateProductionHostLaunchConfigStatus({})).toEqual({
            ok: false,
            reason: "missing_secret",
        });
    });

    it("reports fail-closed configuration status for unsupported clock skew values", () => {
        expect(getCandidateProductionHostLaunchConfigStatus({
            [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: secret,
            [CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS_ENV]: "-1",
        })).toEqual({
            ok: false,
            reason: "invalid_clock_skew",
        });
    });

    it("verifies the expected host token shape with a configurable issuer and clock skew", async () => {
        const token = signHostToken({
            secret,
            payload: {
                candidate_id: "12345",
                product: CANDIDATE_HOST_LAUNCH_PRODUCT,
                email: "candidate@example.com",
                exp: String(Math.floor(now.getTime() / 1000) - 30),
                iat: String(Math.floor(now.getTime() / 1000) - 300),
                iss: "talentarbor",
                job_collection_id: "555",
                host_domain: "talentarbor.com",
                source_surface: "TA_JOB_SEARCH",
            },
        });

        await expect(verifyCandidateProductionHostLaunchToken({
            token,
            secret,
            now,
            expectedIssuer: "talentarbor",
            clockSkewSeconds: 60,
        })).resolves.toEqual({
            ok: true,
            payload: {
                issuer: "talentarbor",
                subject: "candidate:12345",
                email: "candidate@example.com",
                displayName: null,
                workspace: "talentarbor",
                product: CANDIDATE_HOST_LAUNCH_PRODUCT,
                expiresAt: "2026-07-08T11:59:30.000Z",
                issuedAt: "2026-07-08T11:55:00.000Z",
                hostCandidateId: "12345",
                hostUserId: null,
                talentArborId: "12345",
                rangamWorksId: null,
                jobCollectionId: "555",
                hostDomain: "talentarbor.com",
                sourceSurface: "TA_JOB_SEARCH",
            } satisfies CandidateHostLaunchTokenPayload,
        });
    });

    it("rejects tampered tokens with a telemetry-safe reason", async () => {
        const token = signHostToken({
            secret,
            payload: {
                candidate_id: "12345",
                product: CANDIDATE_HOST_LAUNCH_PRODUCT,
                email: "candidate@example.com",
                exp: String(Math.floor(now.getTime() / 1000) + 60),
            },
        });

        await expect(verifyCandidateProductionHostLaunchToken({
            token: `${token}tampered`,
            secret,
            now,
        })).resolves.toEqual({
            ok: false,
            reason: "invalid_signature",
        });
    });

    it("rejects tokens for another product before profile resolution", async () => {
        const token = signHostToken({
            secret,
            payload: {
                candidate_id: "12345",
                product: "other-product",
                email: "candidate@example.com",
                exp: String(Math.floor(now.getTime() / 1000) + 60),
            },
        });

        await expect(verifyCandidateProductionHostLaunchToken({
            token,
            secret,
            now,
        })).resolves.toEqual({
            ok: false,
            reason: "invalid_product",
        });
    });

    it("creates a route-compatible verifier that fails closed when configuration is missing", async () => {
        const verifier = createCandidateProductionHostLaunchVerifier({});

        await expect(verifier("signed.jwt", now)).resolves.toBeNull();
    });

    it("creates a route-compatible verifier when configuration is complete", async () => {
        const token = signHostToken({
            secret,
            payload: {
                candidate_id: "12345",
                product: CANDIDATE_HOST_LAUNCH_PRODUCT,
                email: "candidate@example.com",
                exp: String(Math.floor(now.getTime() / 1000) + 60),
            },
        });
        const verifier = createCandidateProductionHostLaunchVerifier({
            [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: secret,
            [CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER_ENV]: "talentarbor",
        });

        await expect(verifier(token, now)).resolves.toMatchObject({
            issuer: "talentarbor",
            subject: "candidate:12345",
            email: "candidate@example.com",
            hostCandidateId: "12345",
        });
    });
});

function signHostToken({
    secret,
    payload,
}: {
    secret: string;
    payload: Record<string, string>;
}) {
    const encodedHeader = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
    return `${signingInput}.${signature}`;
}

function toBase64Url(value: string) {
    return Buffer.from(value, "utf8").toString("base64url");
}
