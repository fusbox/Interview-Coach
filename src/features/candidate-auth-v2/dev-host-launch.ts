import { createHmac, timingSafeEqual } from "crypto";

import {
    CANDIDATE_HOST_LAUNCH_PRODUCT,
    type CandidateHostLaunchHandoff,
    type CandidateHostLaunchTokenPayload,
} from "./host-launch-contract";

export const CANDIDATE_HOST_LAUNCH_DEV_MODE_ENV = "CANDIDATE_HOST_LAUNCH_DEV_MODE";
export const CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV = "CANDIDATE_HOST_LAUNCH_DEV_SECRET";

const DEV_HOST_ISSUER = "interview-coach-local-host";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;

export type CandidateDevHostLaunchFixture = {
    key: "primary" | "alternate";
    candidateId: string;
    email: string;
    displayName: string;
    workspace: "talentarbor";
    candidateProfileId: string;
};

export const CANDIDATE_DEV_HOST_LAUNCH_FIXTURES: Record<CandidateDevHostLaunchFixture["key"], CandidateDevHostLaunchFixture> = {
    primary: {
        key: "primary",
        candidateId: "100001",
        email: "candidate-dev-primary@talentarbor.local",
        displayName: "Dev Candidate Primary",
        workspace: "talentarbor",
        candidateProfileId: "10000000-0000-4000-8000-000000000001",
    },
    alternate: {
        key: "alternate",
        candidateId: "100002",
        email: "candidate-dev-alt@talentarbor.local",
        displayName: "Dev Candidate Alternate",
        workspace: "talentarbor",
        candidateProfileId: "10000000-0000-4000-8000-000000000002",
    },
};

type CandidateDevHostLaunchTokenPayload = {
    candidate_id: string;
    product: string;
    email: string;
    exp: string;
    iat: string;
};

type CandidateHostLaunchEnv = Partial<Record<
    "NODE_ENV" | typeof CANDIDATE_HOST_LAUNCH_DEV_MODE_ENV | typeof CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV,
    string
>>;

export function isCandidateDevHostLaunchEnabled(env: CandidateHostLaunchEnv = process.env) {
    return env.NODE_ENV !== "production"
        && env[CANDIDATE_HOST_LAUNCH_DEV_MODE_ENV] === "true"
        && Boolean(env[CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV]?.trim());
}

export async function mintCandidateDevHostLaunchToken({
    fixture,
    secret,
    now,
    ttlSeconds = DEFAULT_TTL_SECONDS,
}: {
    fixture: CandidateDevHostLaunchFixture;
    secret: string;
    now: Date;
    ttlSeconds?: number;
}) {
    const issuedAtSeconds = Math.floor(now.getTime() / 1000);
    const payload: CandidateDevHostLaunchTokenPayload = {
        candidate_id: fixture.candidateId,
        product: CANDIDATE_HOST_LAUNCH_PRODUCT,
        email: fixture.email,
        exp: String(issuedAtSeconds + ttlSeconds),
        iat: String(issuedAtSeconds),
    };

    return signDevHostToken(payload, secret);
}

export async function verifyCandidateDevHostLaunchToken({
    token,
    secret,
    now,
}: {
    token: string;
    secret: string;
    now: Date;
}): Promise<CandidateHostLaunchTokenPayload | null> {
    const payload = verifyDevHostToken(token, secret);
    if (!payload) {
        return null;
    }

    const fixture = findFixtureByCandidateId(payload.candidate_id);
    const expiresAtSeconds = Number(payload.exp);
    const issuedAtSeconds = Number(payload.iat);

    if (
        !fixture
        || payload.product !== CANDIDATE_HOST_LAUNCH_PRODUCT
        || payload.email !== fixture.email
        || !Number.isFinite(expiresAtSeconds)
        || expiresAtSeconds <= Math.floor(now.getTime() / 1000)
    ) {
        return null;
    }

    return {
        issuer: DEV_HOST_ISSUER,
        subject: `candidate:${fixture.candidateId}`,
        email: fixture.email,
        displayName: fixture.displayName,
        workspace: fixture.workspace,
        product: payload.product,
        expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
        issuedAt: Number.isFinite(issuedAtSeconds) ? new Date(issuedAtSeconds * 1000).toISOString() : null,
        hostCandidateId: fixture.candidateId,
        hostUserId: null,
        talentArborId: fixture.candidateId,
        rangamWorksId: null,
    };
}

export async function resolveCandidateDevHostLaunchProfile(handoff: CandidateHostLaunchHandoff) {
    const fixture = findFixtureByCandidateId(handoff.externalIds.hostCandidateId);
    if (!fixture || handoff.email !== fixture.email) {
        throw new Error("Unknown local candidate host-launch fixture.");
    }

    return {
        candidateProfileId: fixture.candidateProfileId,
        sessionId: `dev-host-launch-${fixture.candidateId}`,
    };
}

function signDevHostToken(payload: CandidateDevHostLaunchTokenPayload, secret: string) {
    const header = {
        alg: "HS256",
        typ: "JWT",
    };
    const encodedHeader = toBase64Url(JSON.stringify(header));
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    return `${signingInput}.${sign(signingInput, secret)}`;
}

function verifyDevHostToken(token: string, secret: string): CandidateDevHostLaunchTokenPayload | null {
    const [encodedHeader, encodedPayload, signature, extra] = token.split(".");
    if (!encodedHeader || !encodedPayload || !signature || extra) {
        return null;
    }

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    if (!secureEqual(signature, sign(signingInput, secret))) {
        return null;
    }

    try {
        const header = JSON.parse(fromBase64Url(encodedHeader)) as { alg?: string; typ?: string };
        const payload = JSON.parse(fromBase64Url(encodedPayload)) as Partial<CandidateDevHostLaunchTokenPayload>;
        if (header.alg !== "HS256" || header.typ !== "JWT") {
            return null;
        }
        if (!payload.candidate_id || !payload.email || !payload.product || !payload.exp || !payload.iat) {
            return null;
        }
        return {
            candidate_id: payload.candidate_id,
            product: payload.product,
            email: payload.email,
            exp: payload.exp,
            iat: payload.iat,
        };
    } catch {
        return null;
    }
}

function sign(signingInput: string, secret: string) {
    return createHmac("sha256", secret).update(signingInput).digest("base64url");
}

function secureEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function toBase64Url(value: string) {
    return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
    return Buffer.from(value, "base64url").toString("utf8");
}

function findFixtureByCandidateId(candidateId: string | null | undefined) {
    return Object.values(CANDIDATE_DEV_HOST_LAUNCH_FIXTURES).find((fixture) => fixture.candidateId === candidateId) ?? null;
}
