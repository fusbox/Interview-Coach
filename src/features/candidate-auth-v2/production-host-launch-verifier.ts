import { createHmac, timingSafeEqual } from "crypto";

import {
    CANDIDATE_HOST_LAUNCH_PRODUCT,
    type CandidateHostLaunchTokenPayload,
} from "./host-launch-contract";

export const CANDIDATE_HOST_LAUNCH_SECRET_ENV = "CANDIDATE_HOST_LAUNCH_SECRET";
export const CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER_ENV = "CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER";
export const CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS_ENV = "CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS";

const DEFAULT_EXPECTED_ISSUER = "talentarbor";
const DEFAULT_CLOCK_SKEW_SECONDS = 60;
const SUPPORTED_ALGORITHM = "HS256";

export type CandidateProductionHostLaunchConfigEnv = Record<string, string | undefined> & Partial<Record<
    typeof CANDIDATE_HOST_LAUNCH_SECRET_ENV
    | typeof CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER_ENV
    | typeof CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS_ENV,
    string
>>;

export type CandidateProductionHostLaunchConfigStatus =
    | {
        ok: true;
        secret: string;
        expectedIssuer: string;
        clockSkewSeconds: number;
    }
    | {
        ok: false;
        reason: "missing_secret" | "invalid_clock_skew";
    };

export type CandidateProductionHostLaunchTelemetryReason =
    | "malformed_token"
    | "unsupported_algorithm"
    | "invalid_signature"
    | "missing_required_claim"
    | "invalid_expiry"
    | "expired_token"
    | "invalid_product"
    | "invalid_issuer";

export type CandidateProductionHostLaunchVerificationResult =
    | {
        ok: true;
        payload: CandidateHostLaunchTokenPayload;
    }
    | {
        ok: false;
        reason: CandidateProductionHostLaunchTelemetryReason;
    };

type CandidateProductionHostLaunchClaims = {
    candidate_id?: unknown;
    product?: unknown;
    email?: unknown;
    exp?: unknown;
    iat?: unknown;
    iss?: unknown;
    job_collection_id?: unknown;
    host_domain?: unknown;
    source_surface?: unknown;
};

export function getCandidateProductionHostLaunchConfigStatus(
    env: CandidateProductionHostLaunchConfigEnv = process.env,
): CandidateProductionHostLaunchConfigStatus {
    const secret = env[CANDIDATE_HOST_LAUNCH_SECRET_ENV]?.trim();
    if (!secret) {
        return {
            ok: false,
            reason: "missing_secret",
        };
    }

    const clockSkewSeconds = env[CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS_ENV]
        ? Number(env[CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS_ENV])
        : DEFAULT_CLOCK_SKEW_SECONDS;

    if (!Number.isFinite(clockSkewSeconds) || clockSkewSeconds < 0) {
        return {
            ok: false,
            reason: "invalid_clock_skew",
        };
    }

    return {
        ok: true,
        secret,
        expectedIssuer: env[CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER_ENV]?.trim() || DEFAULT_EXPECTED_ISSUER,
        clockSkewSeconds,
    };
}

export function createCandidateProductionHostLaunchVerifier(
    env: CandidateProductionHostLaunchConfigEnv = process.env,
) {
    const config = getCandidateProductionHostLaunchConfigStatus(env);

    return async function verifyConfiguredCandidateProductionHostLaunchToken(token: string, now: Date) {
        if (!config.ok) {
            return null;
        }

        const result = await verifyCandidateProductionHostLaunchToken({
            token,
            now,
            secret: config.secret,
            expectedIssuer: config.expectedIssuer,
            clockSkewSeconds: config.clockSkewSeconds,
        });

        return result.ok ? result.payload : null;
    };
}

export async function verifyCandidateProductionHostLaunchToken({
    token,
    secret,
    now,
    expectedIssuer = DEFAULT_EXPECTED_ISSUER,
    clockSkewSeconds = DEFAULT_CLOCK_SKEW_SECONDS,
}: {
    token: string;
    secret: string;
    now: Date;
    expectedIssuer?: string;
    clockSkewSeconds?: number;
}): Promise<CandidateProductionHostLaunchVerificationResult> {
    const parsed = parseSignedHostToken(token);
    if (!parsed) {
        return fail("malformed_token");
    }
    if (parsed.header.alg !== SUPPORTED_ALGORITHM || parsed.header.typ !== "JWT") {
        return fail("unsupported_algorithm");
    }
    if (!secureEqual(parsed.signature, sign(parsed.signingInput, secret))) {
        return fail("invalid_signature");
    }

    const candidateId = readRequiredStringClaim(parsed.claims.candidate_id);
    const product = readRequiredStringClaim(parsed.claims.product);
    const email = readRequiredStringClaim(parsed.claims.email);
    const exp = readRequiredStringClaim(parsed.claims.exp);

    if (!candidateId || !product || !email || !exp) {
        return fail("missing_required_claim");
    }
    if (product !== CANDIDATE_HOST_LAUNCH_PRODUCT) {
        return fail("invalid_product");
    }

    const issuer = readRequiredStringClaim(parsed.claims.iss) || expectedIssuer;
    if (expectedIssuer && issuer !== expectedIssuer) {
        return fail("invalid_issuer");
    }

    const expiresAtSeconds = Number(exp);
    if (!Number.isFinite(expiresAtSeconds)) {
        return fail("invalid_expiry");
    }
    if ((expiresAtSeconds + clockSkewSeconds) <= Math.floor(now.getTime() / 1000)) {
        return fail("expired_token");
    }

    const issuedAtSeconds = parsed.claims.iat ? Number(parsed.claims.iat) : null;

    return {
        ok: true,
        payload: {
            issuer,
            subject: `candidate:${candidateId}`,
            email,
            displayName: null,
            workspace: "talentarbor",
            product,
            expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
            issuedAt: issuedAtSeconds !== null && Number.isFinite(issuedAtSeconds)
                ? new Date(issuedAtSeconds * 1000).toISOString()
                : null,
            hostCandidateId: candidateId,
            hostUserId: null,
            talentArborId: candidateId,
            rangamWorksId: null,
            jobCollectionId: readOptionalStringClaim(parsed.claims.job_collection_id),
            hostDomain: readOptionalStringClaim(parsed.claims.host_domain),
            sourceSurface: readOptionalStringClaim(parsed.claims.source_surface),
        },
    };
}

function parseSignedHostToken(token: string) {
    const [encodedHeader, encodedPayload, signature, extra] = token.split(".");
    if (!encodedHeader || !encodedPayload || !signature || extra) {
        return null;
    }

    try {
        return {
            header: JSON.parse(fromBase64Url(encodedHeader)) as { alg?: string; typ?: string },
            claims: JSON.parse(fromBase64Url(encodedPayload)) as CandidateProductionHostLaunchClaims,
            signature,
            signingInput: `${encodedHeader}.${encodedPayload}`,
        };
    } catch {
        return null;
    }
}

function readRequiredStringClaim(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function readOptionalStringClaim(value: unknown) {
    const normalized = readRequiredStringClaim(value);
    return normalized || null;
}

function fail(reason: CandidateProductionHostLaunchTelemetryReason): CandidateProductionHostLaunchVerificationResult {
    return {
        ok: false,
        reason,
    };
}

function sign(signingInput: string, secret: string) {
    return createHmac("sha256", secret).update(signingInput).digest("base64url");
}

function secureEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function fromBase64Url(value: string) {
    return Buffer.from(value, "base64url").toString("utf8");
}
