import { randomBytes, scrypt, timingSafeEqual } from "crypto";

const PASSWORD_HASH_PREFIX = "scrypt";
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES).toString("base64url");
    const derivedKey = await derivePasswordKey(password, salt);

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
    if (!parsed) {
        return false;
    }

    const derivedKey = await derivePasswordKey(password, parsed.salt, {
        N: parsed.n,
        r: parsed.r,
        p: parsed.p,
    });
    const storedKey = Buffer.from(parsed.hash, "base64url");

    if (storedKey.length !== derivedKey.length) {
        return false;
    }

    return timingSafeEqual(storedKey, derivedKey);
}

function parsePasswordHash(storedHash: string): {
    n: number;
    r: number;
    p: number;
    salt: string;
    hash: string;
} | null {
    const [prefix, nRaw, rRaw, pRaw, salt, hash] = storedHash.split("$");
    if (prefix !== PASSWORD_HASH_PREFIX || !salt || !hash) {
        return null;
    }

    const n = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
        return null;
    }

    return { n, r, p, salt, hash };
}

async function derivePasswordKey(
    password: string,
    salt: string,
    cost: { N: number; r: number; p: number } = { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }
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
