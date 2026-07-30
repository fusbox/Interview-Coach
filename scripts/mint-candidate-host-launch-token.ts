import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { SignJWT } from "jose";

import { CANDIDATE_HOST_LAUNCH_PRODUCT } from "../src/features/candidate-auth-v2/host-launch-contract";
import {
    CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER_ENV,
    CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS_ENV,
    getCandidateProductionHostLaunchConfigStatus,
} from "../src/features/candidate-auth-v2/production-host-launch-verifier";

loadEnvLocal();

const DEFAULT_CANDIDATE_ID = "353373";
const DEFAULT_EMAIL = "amitkumar+25june26@rangam.com";

async function main() {
    const config = getCandidateProductionHostLaunchConfigStatus(process.env);
    if (!config.ok) {
        console.error(`Host launch mint failed: ${config.reason}`);
        process.exit(1);
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const lifetimeSeconds = Number(
        process.env[CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS_ENV] ?? "120",
    );
    const ttl = Number.isInteger(lifetimeSeconds) && lifetimeSeconds > 0
        ? Math.min(lifetimeSeconds, config.maxTokenLifetimeSeconds)
        : config.maxTokenLifetimeSeconds;

    const candidateId = process.env.HOST_LAUNCH_MINT_CANDIDATE_ID?.trim() || DEFAULT_CANDIDATE_ID;
    const email = process.env.HOST_LAUNCH_MINT_EMAIL?.trim() || DEFAULT_EMAIL;
    const name = process.env.HOST_LAUNCH_MINT_NAME?.trim() || undefined;
    const claims: Record<string, unknown> = {
        candidate_id: candidateId,
        email,
        product: CANDIDATE_HOST_LAUNCH_PRODUCT,
        source_portal: config.expectedWorkspace,
        jti: randomUUID(),
    };
    if (name) {
        claims.name = name;
    }
    const jobCollectionId = process.env.HOST_LAUNCH_MINT_JOB_COLLECTION_ID?.trim();
    const requirementId = process.env.HOST_LAUNCH_MINT_REQUIREMENT_ID?.trim();
    const talentChannelId = process.env.HOST_LAUNCH_MINT_TALENT_CHANNEL_ID?.trim();
    const clientId = process.env.HOST_LAUNCH_MINT_CLIENT_ID?.trim();
    if (jobCollectionId) {
        claims.job_collection_id = jobCollectionId;
    }
    if (requirementId) {
        claims.requirement_id = requirementId;
    }
    if (talentChannelId) {
        claims.talent_channel_id = talentChannelId;
    }
    if (clientId) {
        claims.client_id = clientId;
    }

    const token = await new SignJWT(claims)
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuer(config.expectedIssuer)
        .setIssuedAt(nowSeconds)
        .setExpirationTime(nowSeconds + ttl)
        .sign(Buffer.from(config.secret, "utf8"));

    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
    console.log(`${origin}/candidate/launch?token=${encodeURIComponent(token)}`);
}

function loadEnvLocal() {
    const envPath = resolve(process.cwd(), ".env.local");
    if (!existsSync(envPath)) {
        return;
    }
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }
        const eq = trimmed.indexOf("=");
        if (eq <= 0) {
            continue;
        }
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith("\"") && value.endsWith("\""))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}

void main().catch((error) => {
    console.error("Host launch mint failed.");
    console.error(error instanceof Error ? error.message : "unknown_error");
    process.exit(1);
});
