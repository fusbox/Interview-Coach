import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const PASSWORD_HASH_PREFIX = "scrypt";
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES).toString("base64url");
    const derivedKey = await derivePasswordKey(password, salt, {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
    });

    return [
        PASSWORD_HASH_PREFIX,
        SCRYPT_N,
        SCRYPT_R,
        SCRYPT_P,
        salt,
        derivedKey.toString("base64url"),
    ].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const parsed = parsePasswordHash(storedHash);
    if (!parsed) return false;

    const derivedKey = await derivePasswordKey(password, parsed.salt, parsed.cost);
    const storedKey = Buffer.from(parsed.hash, "base64url");
    if (storedKey.length !== derivedKey.length) return false;

    return timingSafeEqual(storedKey, derivedKey);
}

function parsePasswordHash(storedHash: string): {
    salt: string;
    hash: string;
    cost: { N: number; r: number; p: number };
} | null {
    const [prefix, nRaw, rRaw, pRaw, salt, hash, ...extra] = storedHash.split("$");
    const N = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);

    if (
        prefix !== PASSWORD_HASH_PREFIX
        || !salt
        || !hash
        || extra.length > 0
        || !Number.isInteger(N)
        || !Number.isInteger(r)
        || !Number.isInteger(p)
        || N < 2
        || r < 1
        || p < 1
    ) {
        return null;
    }

    return { salt, hash, cost: { N, r, p } };
}

function derivePasswordKey(
    password: string,
    salt: string,
    cost: { N: number; r: number; p: number },
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        scrypt(password, salt, SCRYPT_KEY_LENGTH, cost, (error, derivedKey) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(derivedKey);
        });
    });
}
