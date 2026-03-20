import { createCipheriv, scryptSync, randomBytes } from "crypto";
import { afterEach, describe, expect, it } from "vitest";

import { decrypt, encrypt } from "./encryption";

const originalSecret = process.env.ENCRYPTION_SECRET;
const originalSalt = process.env.ENCRYPTION_SALT;
const LEGACY_SALT_BYTES = [105, 110, 116, 101, 114, 118, 105, 101, 119, 45, 99, 111, 97, 99, 104, 45, 115, 97, 108, 116];

const encryptWithLegacySalt = (text: string, secret: string) => {
    const iv = randomBytes(12);
    const key = scryptSync(secret, Buffer.from(LEGACY_SALT_BYTES), 32);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
};

describe("encryption", () => {
    afterEach(() => {
        if (originalSecret === undefined) {
            delete process.env.ENCRYPTION_SECRET;
        } else {
            process.env.ENCRYPTION_SECRET = originalSecret;
        }

        if (originalSalt === undefined) {
            delete process.env.ENCRYPTION_SALT;
        } else {
            process.env.ENCRYPTION_SALT = originalSalt;
        }
    });

    it("round-trips ciphertext with the primary derived salt", () => {
        process.env.ENCRYPTION_SECRET = "12345678901234567890123456789012";
        delete process.env.ENCRYPTION_SALT;

        const cipherText = encrypt("invite-token");

        expect(decrypt(cipherText)).toBe("invite-token");
    });

    it("can still decrypt ciphertext created with the legacy static salt", () => {
        process.env.ENCRYPTION_SECRET = "12345678901234567890123456789012";
        delete process.env.ENCRYPTION_SALT;

        const cipherText = encryptWithLegacySalt("historical-token", process.env.ENCRYPTION_SECRET);

        expect(decrypt(cipherText)).toBe("historical-token");
    });
});
