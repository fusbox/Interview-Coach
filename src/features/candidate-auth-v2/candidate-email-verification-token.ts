import { createHash, randomBytes } from "node:crypto";

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

export function generateCandidateEmailVerificationToken(): string {
    return randomBytes(32).toString("base64url");
}

export function hashCandidateEmailVerificationToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export function getCandidateEmailVerificationExpiry(
    now = new Date(),
    env: Readonly<Record<string, string | undefined>> = process.env,
): Date {
    const configured = env.CANDIDATE_EMAIL_VERIFICATION_TTL_SECONDS?.trim();
    const ttl = configured ? Number(configured) : DEFAULT_TTL_SECONDS;
    if (!Number.isInteger(ttl) || ttl < 300 || ttl > 172_800) {
        throw new Error("CANDIDATE_EMAIL_VERIFICATION_TTL_SECONDS must be between 300 and 172800.");
    }
    return new Date(now.getTime() + ttl * 1000);
}
