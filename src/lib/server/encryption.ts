import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "crypto";
import { assertProductionServerEnv, getOptionalServerEnv, getRequiredServerEnv } from "@/lib/server/config/server-env";

/**
 * SOC 2 Compliant Encryption Utility
 * Uses AES-256-GCM for Authenticated Encryption at Rest.
 * 
 * REQUIRED ENV: ENCRYPTION_SECRET (Minimum 32 characters)
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const LEGACY_SALT_BYTES = [105, 110, 116, 101, 114, 118, 105, 101, 119, 45, 99, 111, 97, 99, 104, 45, 115, 97, 108, 116];

assertProductionServerEnv(["ENCRYPTION_SECRET"], "server encryption");

const getRawSecret = () => {
    const rawSecret = getRequiredServerEnv("ENCRYPTION_SECRET", "server encryption");
    if (rawSecret.length < 32) {
        throw new Error("ENCRYPTION_SECRET environment variable is missing or too short (min 32 chars).");
    }
    return rawSecret;
};

const getPrimarySalt = (rawSecret: string) => {
    const configuredSalt = getOptionalServerEnv("ENCRYPTION_SALT");
    if (configuredSalt) {
        return configuredSalt;
    }

    // Deterministic per secret without embedding a literal scrypt salt in source.
    return createHash("sha256").update(rawSecret).update("interview-coach-encryption").digest();
};

const getLegacySalt = () => Buffer.from(LEGACY_SALT_BYTES);

const deriveKey = (rawSecret: string, salt: string | Buffer) => scryptSync(rawSecret, salt, KEY_LENGTH);

// In a production AWS environment, the secret should be fetched from AWS Secrets Manager.
const getSecret = () => {
    const rawSecret = getRawSecret();
    return deriveKey(rawSecret, getPrimarySalt(rawSecret));
};

const getCandidateKeys = () => {
    const rawSecret = getRawSecret();
    const primaryKey = deriveKey(rawSecret, getPrimarySalt(rawSecret));
    const legacyKey = deriveKey(rawSecret, getLegacySalt());
    return primaryKey.equals(legacyKey) ? [primaryKey] : [primaryKey, legacyKey];
};

export function encrypt(text: string): string {
    const iv = randomBytes(IV_LENGTH);
    const key = getSecret();
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Format: iv:tag:encrypted (all hex)
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(cipherText: string): string {
    try {
        const [ivHex, tagHex, encryptedHex] = cipherText.split(":");
        if (!ivHex || !tagHex || !encryptedHex) return "";

        const iv = Buffer.from(ivHex, "hex");
        const tag = Buffer.from(tagHex, "hex");
        const encrypted = Buffer.from(encryptedHex, "hex");
        for (const key of getCandidateKeys()) {
            try {
                const decipher = createDecipheriv(ALGORITHM, key, iv);
                decipher.setAuthTag(tag);

                return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
            } catch {
                // Continue to the next candidate key to support historical ciphertext.
            }
        }

        return "";
    } catch {
        // Silent failure to prevent console flooding on historical data mismatch
        return "";
    }
}
