import { describe, expect, it } from "vitest";

import {
    createInvitedPracticeTokenVault,
    hashInvitedPracticeToken,
} from "./invited-practice-token-vault";

describe("invited practice token vault", () => {
    it("stores authenticated ciphertext and recovers the original high-entropy token", () => {
        const vault = createInvitedPracticeTokenVault({
            ENCRYPTION_SECRET: "local-test-secret-that-is-longer-than-thirty-two-characters",
        });
        const material = vault.createTokenMaterial();

        expect(material.rawToken.length).toBeGreaterThanOrEqual(40);
        expect(material.tokenHash).toBe(hashInvitedPracticeToken(material.rawToken));
        expect(material.tokenCiphertext).not.toContain(material.rawToken);
        expect(vault.decryptToken(material)).toBe(material.rawToken);
    });

    it("fails closed for a missing key, wrong key, or modified ciphertext", () => {
        expect(() => createInvitedPracticeTokenVault({ ENCRYPTION_SECRET: "too-short" })).toThrow(
            /at least 32 characters/,
        );

        const first = createInvitedPracticeTokenVault({
            ENCRYPTION_SECRET: "first-local-test-secret-that-is-longer-than-thirty-two",
        });
        const second = createInvitedPracticeTokenVault({
            ENCRYPTION_SECRET: "second-local-test-secret-that-is-longer-than-thirty-two",
        });
        const material = first.createTokenMaterial();
        const parts = material.tokenCiphertext.split(".");
        parts[4] = `${parts[4].slice(0, 2)}${parts[4][2] === "A" ? "B" : "A"}${parts[4].slice(3)}`;

        expect(() => second.decryptToken(material)).toThrow(/key is unavailable/);
        expect(() => first.decryptToken({
            ...material,
            tokenCiphertext: parts.join("."),
        })).toThrow(/could not be authenticated/);
    });
});
