import { errors, jwtVerify, type JWTPayload } from "jose";

import {
    CANDIDATE_HOST_LAUNCH_PRODUCT,
    type CandidateHostLaunchTokenPayload,
    type CandidateHostLaunchWorkspace,
} from "./host-launch-contract";

export const CANDIDATE_HOST_LAUNCH_SECRET_ENV = "CANDIDATE_HOST_LAUNCH_SECRET";
export const CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER_ENV = "CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER";
export const CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE_ENV = "CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE";
export const CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS_ENV = "CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS";
export const CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS_ENV = "CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS";

const DEFAULT_EXPECTED_ISSUER = "talentarbor";
const DEFAULT_EXPECTED_WORKSPACE: CandidateHostLaunchWorkspace = "talentarbor";
const DEFAULT_CLOCK_SKEW_SECONDS = 30;
const DEFAULT_MAX_TOKEN_LIFETIME_SECONDS = 120;
const MAX_CONFIGURED_TOKEN_LIFETIME_SECONDS = 15 * 60;
const MIN_SHARED_SECRET_BYTES = 32;
const SUPPORTED_ALGORITHM = "HS256";

export type CandidateProductionHostLaunchConfigEnv = Record<string, string | undefined> & Partial<Record<
    typeof CANDIDATE_HOST_LAUNCH_SECRET_ENV
    | typeof CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER_ENV
    | typeof CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE_ENV
    | typeof CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS_ENV
    | typeof CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS_ENV,
    string
>>;

export type CandidateProductionHostLaunchConfigStatus =
    | {
        ok: true;
        secret: string;
        expectedIssuer: string;
        expectedWorkspace: CandidateHostLaunchWorkspace;
        clockSkewSeconds: number;
        maxTokenLifetimeSeconds: number;
    }
    | {
        ok: false;
        reason: "missing_secret" | "invalid_secret" | "invalid_clock_skew" | "invalid_token_lifetime" | "invalid_workspace";
    };

export type CandidateProductionHostLaunchTelemetryReason =
    | "malformed_token"
    | "unsupported_algorithm"
    | "invalid_signature"
    | "missing_required_claim"
    | "invalid_expiry"
    | "expired_token"
    | "issued_in_future"
    | "token_lifetime_exceeded"
    | "invalid_product"
    | "invalid_issuer"
    | "invalid_source_portal";

export type CandidateProductionHostLaunchVerificationResult =
    | {
        ok: true;
        payload: CandidateHostLaunchTokenPayload;
    }
    | {
        ok: false;
        reason: CandidateProductionHostLaunchTelemetryReason;
    };

type CandidateProductionHostLaunchClaims = JWTPayload & {
    candidate_id?: unknown;
    product?: unknown;
    email?: unknown;
    job_collection_id?: unknown;
    host_domain?: unknown;
    source_surface?: unknown;
    source_portal?: unknown;
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
    if (Buffer.byteLength(secret, "utf8") < MIN_SHARED_SECRET_BYTES) {
        return {
            ok: false,
            reason: "invalid_secret",
        };
    }

    const clockSkewSeconds = readIntegerConfig(
        env[CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS_ENV],
        DEFAULT_CLOCK_SKEW_SECONDS,
    );
    if (clockSkewSeconds === null || clockSkewSeconds < 0) {
        return {
            ok: false,
            reason: "invalid_clock_skew",
        };
    }

    const maxTokenLifetimeSeconds = readIntegerConfig(
        env[CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS_ENV],
        DEFAULT_MAX_TOKEN_LIFETIME_SECONDS,
    );
    if (
        maxTokenLifetimeSeconds === null
        || maxTokenLifetimeSeconds <= 0
        || maxTokenLifetimeSeconds > MAX_CONFIGURED_TOKEN_LIFETIME_SECONDS
    ) {
        return {
            ok: false,
            reason: "invalid_token_lifetime",
        };
    }

    const expectedWorkspace = readWorkspace(
        env[CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE_ENV] ?? DEFAULT_EXPECTED_WORKSPACE,
    );
    if (!expectedWorkspace) {
        return {
            ok: false,
            reason: "invalid_workspace",
        };
    }

    return {
        ok: true,
        secret,
        expectedIssuer: env[CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER_ENV]?.trim() || DEFAULT_EXPECTED_ISSUER,
        expectedWorkspace,
        clockSkewSeconds,
        maxTokenLifetimeSeconds,
    };
}

export function createCandidateProductionHostLaunchVerifier(
    env: CandidateProductionHostLaunchConfigEnv = process.env,
    options: {
        onDiagnostic?: (reason: CandidateProductionHostLaunchTelemetryReason) => void;
    } = {},
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
            expectedWorkspace: config.expectedWorkspace,
            clockSkewSeconds: config.clockSkewSeconds,
            maxTokenLifetimeSeconds: config.maxTokenLifetimeSeconds,
        });

        if (!result.ok) {
            try {
                options.onDiagnostic?.(result.reason);
            } catch {
                // Verification results must not depend on observability delivery.
            }
        }

        return result.ok ? result.payload : null;
    };
}

export async function verifyCandidateProductionHostLaunchToken({
    token,
    secret,
    now,
    expectedIssuer = DEFAULT_EXPECTED_ISSUER,
    expectedWorkspace = DEFAULT_EXPECTED_WORKSPACE,
    clockSkewSeconds = DEFAULT_CLOCK_SKEW_SECONDS,
    maxTokenLifetimeSeconds = DEFAULT_MAX_TOKEN_LIFETIME_SECONDS,
}: {
    token: string;
    secret: string;
    now: Date;
    expectedIssuer?: string;
    expectedWorkspace?: CandidateHostLaunchWorkspace;
    clockSkewSeconds?: number;
    maxTokenLifetimeSeconds?: number;
}): Promise<CandidateProductionHostLaunchVerificationResult> {
    let verified: {
        protectedHeader: { typ?: string };
        payload: JWTPayload;
    };
    try {
        verified = await jwtVerify(token, Buffer.from(secret, "utf8"), {
            algorithms: [SUPPORTED_ALGORITHM],
            issuer: expectedIssuer,
            currentDate: now,
            clockTolerance: 0,
        });
    } catch (error) {
        return fail(mapVerificationError(error));
    }

    if (verified.protectedHeader.typ !== "JWT") {
        return fail("unsupported_algorithm");
    }

    const claims = verified.payload as CandidateProductionHostLaunchClaims;
    const candidateId = readRequiredStringClaim(claims.candidate_id);
    const product = readRequiredStringClaim(claims.product);
    const email = readRequiredStringClaim(claims.email);
    const issuer = readRequiredStringClaim(claims.iss);
    if (!candidateId || !product || !email || !issuer || claims.exp === undefined || claims.iat === undefined) {
        return fail("missing_required_claim");
    }
    if (product !== CANDIDATE_HOST_LAUNCH_PRODUCT) {
        return fail("invalid_product");
    }

    const expiresAtSeconds = readNumericDate(claims.exp);
    const issuedAtSeconds = readNumericDate(claims.iat);
    if (expiresAtSeconds === null || issuedAtSeconds === null || expiresAtSeconds <= issuedAtSeconds) {
        return fail("invalid_expiry");
    }

    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (issuedAtSeconds > nowSeconds + clockSkewSeconds) {
        return fail("issued_in_future");
    }
    if (expiresAtSeconds - issuedAtSeconds > maxTokenLifetimeSeconds) {
        return fail("token_lifetime_exceeded");
    }

    const sourcePortal = readOptionalStringClaim(claims.source_portal);
    if (sourcePortal && sourcePortal !== expectedWorkspace) {
        return fail("invalid_source_portal");
    }

    return {
        ok: true,
        payload: {
            issuer,
            subject: `candidate:${candidateId}`,
            email,
            displayName: null,
            workspace: expectedWorkspace,
            product,
            expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
            issuedAt: new Date(issuedAtSeconds * 1000).toISOString(),
            tokenId: readOptionalStringClaim(claims.jti),
            hostCandidateId: candidateId,
            hostUserId: null,
            talentArborId: expectedWorkspace === "talentarbor" ? candidateId : null,
            rangamWorksId: expectedWorkspace === "rangamworks" ? candidateId : null,
            jobCollectionId: readOptionalStringClaim(claims.job_collection_id),
            hostDomain: readOptionalStringClaim(claims.host_domain),
            sourceSurface: readOptionalStringClaim(claims.source_surface),
        },
    };
}

function mapVerificationError(error: unknown): CandidateProductionHostLaunchTelemetryReason {
    if (error instanceof errors.JWTExpired) {
        return "expired_token";
    }
    if (error instanceof errors.JWTClaimValidationFailed) {
        if (error.claim === "iss") {
            return "invalid_issuer";
        }
        if (error.claim === "exp") {
            return "invalid_expiry";
        }
        return "malformed_token";
    }
    if (error instanceof errors.JOSEAlgNotAllowed) {
        return "unsupported_algorithm";
    }
    if (error instanceof errors.JWSSignatureVerificationFailed) {
        return "invalid_signature";
    }
    return "malformed_token";
}

function readIntegerConfig(value: string | undefined, fallback: number) {
    if (value === undefined) {
        return fallback;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
}

function readWorkspace(value: string): CandidateHostLaunchWorkspace | null {
    const normalized = value.trim().toLowerCase();
    return normalized === "talentarbor" || normalized === "rangamworks" ? normalized : null;
}

function readRequiredStringClaim(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function readOptionalStringClaim(value: unknown) {
    const normalized = readRequiredStringClaim(value);
    return normalized || null;
}

function readNumericDate(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function fail(reason: CandidateProductionHostLaunchTelemetryReason): CandidateProductionHostLaunchVerificationResult {
    return {
        ok: false,
        reason,
    };
}
