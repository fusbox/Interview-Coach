import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
});

describe("getAppOrigin", () => {
    it("prefers NEXT_PUBLIC_APP_URL when configured", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "test",
            NEXT_PUBLIC_APP_URL: "https://app.example.com",
            NEXT_PUBLIC_BASE_URL: "https://base.example.com",
        };

        const { getAppOrigin } = await import("./get-app-origin");

        expect(getAppOrigin("http://localhost:3000/api/recruiter/invites")).toBe("https://app.example.com");
    });

    it("falls back to NEXT_PUBLIC_BASE_URL when app url is absent", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "test",
            NEXT_PUBLIC_BASE_URL: "https://base.example.com",
        };
        delete process.env.NEXT_PUBLIC_APP_URL;

        const { getAppOrigin } = await import("./get-app-origin");

        expect(getAppOrigin("http://localhost:3000/api/recruiter/invites")).toBe("https://base.example.com");
    });

    it("normalizes 0.0.0.0 request origins to localhost", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "test",
        };
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.NEXT_PUBLIC_BASE_URL;

        const { getAppOrigin } = await import("./get-app-origin");

        expect(getAppOrigin("http://0.0.0.0:3000/api/recruiter/invites")).toBe("http://localhost:3000");
    });

    it("fails fast in production when no configured public origin is available and no request url is provided", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "production",
        };
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.NEXT_PUBLIC_BASE_URL;

        const { getAppOrigin } = await import("./get-app-origin");

        expect(() => getAppOrigin()).toThrow(
            "[ServerEnv] Missing required environment variable NEXT_PUBLIC_APP_URL for public app origin resolution."
        );
    });

    it("fails fast in production even when a request url is provided but NEXT_PUBLIC_APP_URL is missing", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "production",
        };
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.NEXT_PUBLIC_BASE_URL;

        const { getAppOrigin } = await import("./get-app-origin");

        expect(() => getAppOrigin("https://untrusted.example.com/api/recruiter/invites")).toThrow(
            "[ServerEnv] Missing required environment variable NEXT_PUBLIC_APP_URL for public app origin resolution."
        );
    });

    it("requires NEXT_PUBLIC_APP_URL in production even when NEXT_PUBLIC_BASE_URL is present", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "production",
            NEXT_PUBLIC_BASE_URL: "https://base.example.com",
        };
        delete process.env.NEXT_PUBLIC_APP_URL;

        const { getAppOrigin } = await import("./get-app-origin");

        expect(() => getAppOrigin()).toThrow(
            "[ServerEnv] Missing required environment variable NEXT_PUBLIC_APP_URL for public app origin resolution."
        );
    });

    it("throws for malformed configured origins", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "test",
            NEXT_PUBLIC_APP_URL: "not-a-url",
        };

        const { getAppOrigin } = await import("./get-app-origin");

        expect(() => getAppOrigin("http://localhost:3000/api/recruiter/invites")).toThrow();
    });
});
