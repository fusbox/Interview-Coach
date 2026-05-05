import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCachedUserMock, recordAuthDenialMock } = vi.hoisted(() => ({
    getCachedUserMock: vi.fn(),
    recordAuthDenialMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
    getCachedUser: getCachedUserMock,
}));

vi.mock("@/lib/server/metrics", () => ({
    recordAuthDenial: recordAuthDenialMock,
}));

describe("getAuthenticatedRouteUser", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the current cached user", async () => {
        getCachedUserMock.mockResolvedValue({
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
        getCachedUserMock.mockResolvedValue(null);
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
