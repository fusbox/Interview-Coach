import { createHash, randomBytes } from "node:crypto";

const DEFAULT_TTL_SECONDS = 30 * 60;

export function generateCandidatePasswordResetToken(): string {
    return randomBytes(32).toString("base64url");
}

export function hashCandidatePasswordResetToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export function getCandidatePasswordResetExpiry(
    now = new Date(),
    env: Readonly<Record<string, string | undefined>> = process.env,
): Date {
    const ttl = getCandidatePasswordResetTtlSeconds(env);
    return new Date(now.getTime() + ttl * 1000);
}

export function getCandidatePasswordResetTtlSeconds(
    env: Readonly<Record<string, string | undefined>> = process.env,
): number {
    const configured = env.CANDIDATE_PASSWORD_RESET_TTL_SECONDS?.trim();
    const ttl = configured ? Number(configured) : DEFAULT_TTL_SECONDS;
    if (!Number.isInteger(ttl) || ttl < 300 || ttl > 3_600) {
        throw new Error("CANDIDATE_PASSWORD_RESET_TTL_SECONDS must be between 300 and 3600.");
    }
    return ttl;
}
