import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, getUserBySessionTokenMock, recordAuthDenialMock } = vi.hoisted(() => ({
    cookiesMock: vi.fn(),
    getUserBySessionTokenMock: vi.fn(),
    recordAuthDenialMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
    cookies: cookiesMock,
}));

vi.mock("react", () => ({
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock("@/lib/server/auth/app-auth", () => ({
    getUserBySessionToken: getUserBySessionTokenMock,
}));

vi.mock("@/lib/server/metrics", () => ({
    recordAuthDenial: recordAuthDenialMock,
}));

describe("getAuthenticatedRouteUser", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cookiesMock.mockResolvedValue({
            get: vi.fn(() => ({ value: "session-token" })),
        });
    });

    it("returns the current cached user", async () => {
        getUserBySessionTokenMock.mockResolvedValue({
            id: "user-1",
            email: "recruiter@example.com",
        });
        const { getAuthenticatedRouteUser } = await import("./current-user");

        await expect(getAuthenticatedRouteUser({
            actorType: "recruiter",
            route: "/api/example",
        })).resolves.toMatchObject({
            id: "user-1",
        });
        expect(recordAuthDenialMock).not.toHaveBeenCalled();
    });

    it("records an auth denial when no user is present", async () => {
        getUserBySessionTokenMock.mockResolvedValue(null);
        const { getAuthenticatedRouteUser } = await import("./current-user");

        await expect(getAuthenticatedRouteUser({
            actorType: "recruiter",
            route: "/api/example",
        })).resolves.toBeNull();
        expect(recordAuthDenialMock).toHaveBeenCalledWith({
            actorType: "recruiter",
            route: "/api/example",
            reason: "missing_authenticated_user",
        });
    });
});
