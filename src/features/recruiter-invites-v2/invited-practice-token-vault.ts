import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
    scryptSync,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const TOKEN_BYTES = 32;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const FORMAT_VERSION = "v1";
const SECRET_ENV = "ENCRYPTION_SECRET";
const KEY_PURPOSE = "interview-coach-invited-practice-token-v1";

export type InvitedPracticeTokenVault = {
    createTokenMaterial(): {
        rawToken: string;
        tokenHash: string;
        tokenCiphertext: string;
        encryptionKeyId: string;
    };
    decryptToken(input: {
        tokenCiphertext: string;
        encryptionKeyId: string;
    }): string;
};

export function hashInvitedPracticeToken(rawToken: string) {
    return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function createInvitedPracticeTokenVault(
    env: Readonly<Record<string, string | undefined>> = process.env,
): InvitedPracticeTokenVault {
    const secret = env[SECRET_ENV]?.trim();
    if (!secret || secret.length < 32) {
        throw new Error(`${SECRET_ENV} must contain at least 32 characters for invited-practice token encryption.`);
    }

    const key = scryptSync(secret, KEY_PURPOSE, KEY_BYTES);
    const encryptionKeyId = createHash("sha256").update(key).digest("hex").slice(0, 16);

    return {
        createTokenMaterial() {
            const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
            const iv = randomBytes(IV_BYTES);
            const cipher = createCipheriv(ALGORITHM, key, iv);
            const encrypted = Buffer.concat([
                cipher.update(rawToken, "utf8"),
                cipher.final(),
            ]);
            const tag = cipher.getAuthTag();
            const tokenCiphertext = [
                FORMAT_VERSION,
                encryptionKeyId,
                iv.toString("base64url"),
                tag.toString("base64url"),
                encrypted.toString("base64url"),
            ].join(".");

            return {
                rawToken,
                tokenHash: hashInvitedPracticeToken(rawToken),
                tokenCiphertext,
                encryptionKeyId,
            };
        },
        decryptToken(input) {
            if (input.encryptionKeyId !== encryptionKeyId) {
                throw new Error("Invited-practice token encryption key is unavailable.");
            }

            const [version, ciphertextKeyId, ivValue, tagValue, encryptedValue, ...rest] = input.tokenCiphertext.split(".");
            if (
                version !== FORMAT_VERSION
                || ciphertextKeyId !== encryptionKeyId
                || !ivValue
                || !tagValue
                || !encryptedValue
                || rest.length > 0
            ) {
                throw new Error("Invited-practice token ciphertext is invalid.");
            }

            try {
                const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivValue, "base64url"));
                decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
                const rawToken = Buffer.concat([
                    decipher.update(Buffer.from(encryptedValue, "base64url")),
                    decipher.final(),
                ]).toString("utf8");

                if (hashInvitedPracticeToken(rawToken).length !== 64) {
                    throw new Error("Invalid decrypted token.");
                }
                return rawToken;
            } catch {
                throw new Error("Invited-practice token ciphertext could not be authenticated.");
            }
        },
    };
}
