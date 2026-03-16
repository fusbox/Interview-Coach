import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * SOC 2 Compliant Encryption Utility
 * Uses AES-256-GCM for Authenticated Encryption at Rest.
 * 
 * REQUIRED ENV: ENCRYPTION_SECRET (Minimum 32 characters)
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
// SECURE KEY DERIVATION
// In a production AWS environment, the secret should be fetched from AWS Secrets Manager.
const getSecret = () => {
    const rawSecret = process.env.ENCRYPTION_SECRET;
    if (!rawSecret || rawSecret.length < 32) {
        throw new Error("ENCRYPTION_SECRET environment variable is missing or too short (min 32 chars).");
    }
    return scryptSync(rawSecret, "interview-coach-salt", 32);
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
        const key = getSecret();

        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    } catch {
        // Silent failure to prevent console flooding on historical data mismatch
        return "";
    }
}
