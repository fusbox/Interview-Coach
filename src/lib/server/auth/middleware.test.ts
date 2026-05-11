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

    it.each([
        ["/recruiter?tab=open", "https://interviewcoach.test/login?next=%2Frecruiter%3Ftab%3Dopen"],
        ["/recruiter/dashboard", "https://interviewcoach.test/login?next=%2Frecruiter%2Fdashboard"],
        ["/recruiter/templates", "https://interviewcoach.test/login?next=%2Frecruiter%2Ftemplates"],
        ["/recruiter/settings", "https://interviewcoach.test/login?next=%2Frecruiter%2Fsettings"],
        ["/admin/feedback", "https://interviewcoach.test/login?next=%2Fadmin%2Ffeedback"],
        ["/qa/ai-quality", "https://interviewcoach.test/login?next=%2Fqa%2Fai-quality"],
    ])("redirects recruiter-owned protected page %s without an app session cookie", (path, expectedLocation) => {
        const response = updateSession(makeRequest(path));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(expectedLocation);
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

    it.each([
        ["/practice", "https://interviewcoach.test/auth/talentarbor/start?next=%2Fpractice"],
        ["/dashboard", "https://interviewcoach.test/auth/talentarbor/start?next=%2Fdashboard"],
        ["/settings", "https://interviewcoach.test/auth/talentarbor/start?next=%2Fdashboard"],
        ["/session/session_123", "https://interviewcoach.test/auth/talentarbor/start?next=%2Fsession%2Fsession_123"],
        ["/summary/session_123", "https://interviewcoach.test/auth/talentarbor/start?next=%2Fsummary%2Fsession_123"],
    ])("redirects candidate protected route %s through candidate login when external auth is active", (path, expectedLocation) => {
        process.env.CANDIDATE_AUTH_MODE = "external";

        const response = updateSession(makeRequest(path));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(expectedLocation);
    });

    it.each([
        ["/practice"],
        ["/dashboard"],
        ["/session/session_123"],
        ["/summary/session_123"],
    ])("allows candidate protected route %s in explicit local mock mode", (path) => {
        process.env.CANDIDATE_AUTH_MODE = "mock";

        const response = updateSession(makeRequest(path));

        expect(response.status).toBe(200);
        expect(response.headers.get("location")).toBeNull();
    });

    it.each([
        ["/"],
        ["/auth/talentarbor/start?next=/practice"],
        ["/s/invite-token"],
    ])("does not let recruiter middleware claim candidate or public route %s", (path) => {
        const response = updateSession(makeRequest(path));

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
