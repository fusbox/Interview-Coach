import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("app password hashing", () => {
    it("round-trips a scrypt credential without storing the plaintext", async () => {
        const hash = await hashPassword("correct horse battery staple");

        expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
        expect(hash).not.toContain("correct horse battery staple");
        await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
        await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
    });

    it.each([
        "",
        "bcrypt$not-supported",
        "scrypt$bad$8$1$salt$hash",
        "scrypt$16384$8$1$$hash",
        "scrypt$16384$8$1$salt$hash$extra",
    ])("rejects malformed credential %s", async (hash) => {
        await expect(verifyPassword("password", hash)).resolves.toBe(false);
    });
});
