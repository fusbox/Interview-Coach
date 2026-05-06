import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "./middleware";

vi.mock("@/lib/logger", () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

const ORIGINAL_ENV = { ...process.env };

function makeRequest(path: string, cookie?: string) {
    return new NextRequest(new URL(`https://interviewcoach.test${path}`), {
        headers: cookie ? { cookie } : undefined,
    });
}

describe("updateSession app-auth middleware", () => {
    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
        vi.clearAllMocks();
    });

    it("redirects protected recruiter pages without an app session cookie", () => {
        const response = updateSession(makeRequest("/recruiter?tab=open"));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
            "https://interviewcoach.test/login?next=%2Frecruiter%3Ftab%3Dopen"
        );
    });

    it("allows protected recruiter pages with an app session cookie", () => {
        const response = updateSession(makeRequest("/recruiter", "ic_app_session=session-token"));

        expect(response.status).toBe(200);
        expect(response.headers.get("location")).toBeNull();
    });

    it("uses the configured app session cookie name", () => {
        process.env.AUTH_COOKIE_NAME = "custom_session";

        const response = updateSession(makeRequest("/qa/ai-quality", "custom_session=session-token"));

        expect(response.status).toBe(200);
        expect(response.headers.get("location")).toBeNull();
    });

    it("allows public candidate pages without an app session cookie", () => {
        const response = updateSession(makeRequest("/s/invite-token"));

        expect(response.status).toBe(200);
        expect(response.headers.get("location")).toBeNull();
    });

    it("allows E2E recruiter sessions without an app session cookie", () => {
        process.env.E2E_TEST_MODE = "true";

        const response = updateSession(makeRequest("/recruiter", "e2e-auth=recruiter"));

        expect(response.status).toBe(200);
        expect(response.headers.get("location")).toBeNull();
    });
});
