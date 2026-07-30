// @vitest-environment node

import { createHmac } from "crypto";
import { describe, expect, it, vi } from "vitest";

import { CANDIDATE_HOST_LAUNCH_PRODUCT } from "./host-launch-contract";
import {
    CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS_ENV,
    CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER_ENV,
    CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE_ENV,
    CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS_ENV,
    CANDIDATE_HOST_LAUNCH_SECRET_ENV,
    createCandidateProductionHostLaunchVerifier,
    getCandidateProductionHostLaunchConfigStatus,
    verifyCandidateProductionHostLaunchToken,
} from "./production-host-launch-verifier";

describe("candidate production host launch verifier boundary", () => {
    const now = new Date("2026-07-08T12:00:00.000Z");
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const secret = "production-shared-secret-at-least-32-bytes";

    it("reports fail-closed configuration errors", () => {
        expect(getCandidateProductionHostLaunchConfigStatus({})).toEqual({
            ok: false,
            reason: "missing_secret",
        });
        expect(getCandidateProductionHostLaunchConfigStatus({
            [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: "too-short",
        })).toEqual({
            ok: false,
            reason: "invalid_secret",
        });
        expect(getCandidateProductionHostLaunchConfigStatus({
            [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: secret,
            [CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS_ENV]: "-1",
        })).toEqual({
            ok: false,
            reason: "invalid_clock_skew",
        });
        expect(getCandidateProductionHostLaunchConfigStatus({
            [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: secret,
            [CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS_ENV]: "3600",
        })).toEqual({
            ok: false,
            reason: "invalid_token_lifetime",
        });
        expect(getCandidateProductionHostLaunchConfigStatus({
            [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: secret,
            [CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE_ENV]: "unknown",
        })).toEqual({
            ok: false,
            reason: "invalid_workspace",
        });
    });

    it("verifies the recommended numeric-date TA token with optional job context", async () => {
        const token = signHostToken({
            secret,
            payload: {
                candidate_id: "12345",
                product: CANDIDATE_HOST_LAUNCH_PRODUCT,
                email: "candidate@example.com",
                name: "Candidate Example",
                iss: "talentarbor",
                source_portal: "talentarbor",
                iat: nowSeconds,
                exp: nowSeconds + 120,
                jti: "launch-123",
                job_collection_id: "555",
                requirement_id: "777",
                talent_channel_id: "0",
                client_id: "13",
                host_domain: "talentarbor.com",
                source_surface: "TA_JOB_SEARCH",
            },
        });

        await expect(verifyCandidateProductionHostLaunchToken({
            token,
            secret,
            now,
        })).resolves.toEqual({
            ok: true,
            payload: {
                issuer: "talentarbor",
                subject: "candidate:12345",
                email: "candidate@example.com",
                displayName: "Candidate Example",
                workspace: "talentarbor",
                product: CANDIDATE_HOST_LAUNCH_PRODUCT,
                expiresAt: "2026-07-08T12:02:00.000Z",
                issuedAt: "2026-07-08T12:00:00.000Z",
                tokenId: "launch-123",
                hostCandidateId: "12345",
                hostUserId: null,
                talentArborId: "12345",
                rangamWorksId: null,
                jobCollectionId: "555",
                requirementId: "777",
                talentChannelId: "0",
                clientId: "13",
                hostDomain: "talentarbor.com",
                sourceSurface: "TA_JOB_SEARCH",
            },
        });
    });

    it("allows a dashboard token without job context", async () => {
        const result = await verifyCandidateProductionHostLaunchToken({
            token: validToken(),
            secret,
            now,
        });

        expect(result).toMatchObject({
            ok: true,
            payload: {
                hostCandidateId: "12345",
                jobCollectionId: null,
            },
        });
    });

    it("reports the exact telemetry-safe rejection reason through the configured verifier", async () => {
        const onDiagnostic = vi.fn();
        const verify = createCandidateProductionHostLaunchVerifier({
            [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: secret,
            [CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER_ENV]: "talentarbor",
            [CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE_ENV]: "talentarbor",
        }, { onDiagnostic });
        const token = signHostToken({
            secret,
            payload: baseClaims({ iss: "rangamworks" }),
        });

        await expect(verify(token, now)).resolves.toBeNull();
        expect(onDiagnostic).toHaveBeenCalledWith("invalid_issuer");
        expect(JSON.stringify(onDiagnostic.mock.calls)).not.toContain(token);
        expect(JSON.stringify(onDiagnostic.mock.calls)).not.toContain("candidate@example.com");

        const verifyWithBrokenSink = createCandidateProductionHostLaunchVerifier({
            [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: secret,
            [CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER_ENV]: "talentarbor",
            [CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE_ENV]: "talentarbor",
        }, {
            onDiagnostic() {
                throw new Error("diagnostic sink unavailable");
            },
        });
        await expect(verifyWithBrokenSink(token, now)).resolves.toBeNull();
    });

    it.each([
        ["string expiry", { exp: String(nowSeconds + 120) }, "invalid_expiry"],
        ["expired token", { exp: nowSeconds - 1 }, "expired_token"],
        ["overlong lifetime", { exp: nowSeconds + 121 }, "token_lifetime_exceeded"],
        ["future issue time", { iat: nowSeconds + 31, exp: nowSeconds + 120 }, "issued_in_future"],
        ["wrong product", { product: "resume-builder" }, "invalid_product"],
        ["wrong issuer", { iss: "rangamworks" }, "invalid_issuer"],
        ["wrong source portal", { source_portal: "rangamworks" }, "invalid_source_portal"],
    ])("rejects %s with a telemetry-safe reason", async (_label, overrides, reason) => {
        const token = signHostToken({
            secret,
            payload: baseClaims(overrides),
        });

        await expect(verifyCandidateProductionHostLaunchToken({
            token,
            secret,
            now,
        })).resolves.toEqual({ ok: false, reason });
    });

    it("rejects tampered tokens", async () => {
        await expect(verifyCandidateProductionHostLaunchToken({
            token: `${validToken()}tampered`,
            secret,
            now,
        })).resolves.toEqual({
            ok: false,
            reason: "invalid_signature",
        });
    });

    it("creates a route-compatible verifier that fails closed when configuration is missing", async () => {
        const verifier = createCandidateProductionHostLaunchVerifier({});
        await expect(verifier("signed.jwt", now)).resolves.toBeNull();
    });

    it("creates a configured TA verifier", async () => {
        const verifier = createCandidateProductionHostLaunchVerifier({
            [CANDIDATE_HOST_LAUNCH_SECRET_ENV]: secret,
            [CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER_ENV]: "talentarbor",
            [CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE_ENV]: "talentarbor",
        });

        await expect(verifier(validToken(), now)).resolves.toMatchObject({
            issuer: "talentarbor",
            subject: "candidate:12345",
            email: "candidate@example.com",
            hostCandidateId: "12345",
        });
    });

    function validToken() {
        return signHostToken({ secret, payload: baseClaims() });
    }

    function baseClaims(overrides: Record<string, unknown> = {}) {
        return {
            candidate_id: "12345",
            product: CANDIDATE_HOST_LAUNCH_PRODUCT,
            email: "candidate@example.com",
            iss: "talentarbor",
            iat: nowSeconds,
            exp: nowSeconds + 120,
            ...overrides,
        };
    }
});

function signHostToken({
    secret,
    payload,
}: {
    secret: string;
    payload: Record<string, unknown>;
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
