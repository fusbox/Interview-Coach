import { describe, expect, it } from "vitest";

import { getAppUserDisplayName, type AppUser } from "./app-user";

describe("app user display identity", () => {
    it("prefers a nonempty account display name", () => {
        expect(getAppUserDisplayName(user({ displayName: "  Fu Chen  " }))).toBe("Fu Chen");
    });

    it("falls back through provisioned name fields to email", () => {
        expect(getAppUserDisplayName(user({ displayName: " ", firstName: " Dev ", lastName: " Recruiter " })))
            .toBe("Dev Recruiter");
        expect(getAppUserDisplayName(user({ displayName: "", firstName: "", lastName: "" })))
            .toBe("dev@example.invalid");
    });
});

function user(overrides: Partial<AppUser>): AppUser {
    return {
        id: "user-1",
        email: "dev@example.invalid",
        status: "active",
        roles: ["recruiter"],
        ...overrides,
    };
}
