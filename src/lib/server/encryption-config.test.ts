import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
});

describe("encryption configuration", () => {
    it("allows local/test imports without ENCRYPTION_SECRET", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "test",
        };
        delete process.env.ENCRYPTION_SECRET;

        const encryption = await import("./encryption");

        expect(encryption.encrypt).toBeDefined();
        expect(encryption.decrypt).toBeDefined();
    });

    it("fails fast in production when ENCRYPTION_SECRET is missing", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "production",
        };
        delete process.env.ENCRYPTION_SECRET;

        await expect(import("./encryption")).rejects.toThrow(
            "[ServerEnv] Missing required environment variable ENCRYPTION_SECRET for server encryption."
        );
    });
});
