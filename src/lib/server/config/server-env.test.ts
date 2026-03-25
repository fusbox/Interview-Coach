import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
});

describe("server env contract", () => {
    it("returns trimmed optional env values", async () => {
        process.env.OPTIONAL_VALUE = "  hello  ";
        const { getOptionalServerEnv } = await import("./server-env");

        expect(getOptionalServerEnv("OPTIONAL_VALUE")).toBe("hello");
    });

    it("treats blank optional env values as missing", async () => {
        process.env.OPTIONAL_VALUE = "   ";
        const { getOptionalServerEnv } = await import("./server-env");

        expect(getOptionalServerEnv("OPTIONAL_VALUE")).toBeUndefined();
    });

    it("throws for missing required env", async () => {
        delete process.env.REQUIRED_VALUE;
        const { getRequiredServerEnv } = await import("./server-env");

        expect(() => getRequiredServerEnv("REQUIRED_VALUE", "test context")).toThrow(
            "[ServerEnv] Missing required environment variable REQUIRED_VALUE for test context."
        );
    });

    it("only enforces production-required env in production", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "development",
        };
        delete process.env.REQUIRED_IN_PROD;
        const { assertProductionServerEnv } = await import("./server-env");

        expect(() => assertProductionServerEnv(["REQUIRED_IN_PROD"], "production-only check")).not.toThrow();
    });

    it("fails production-required env checks in production", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "production",
        };
        delete process.env.REQUIRED_IN_PROD;
        const { assertProductionServerEnv } = await import("./server-env");

        expect(() => assertProductionServerEnv(["REQUIRED_IN_PROD"], "production-only check")).toThrow(
            "[ServerEnv] Missing required environment variable REQUIRED_IN_PROD for production-only check."
        );
    });
});
