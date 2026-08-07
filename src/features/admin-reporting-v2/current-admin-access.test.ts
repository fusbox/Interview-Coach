import { describe, expect, it, vi } from "vitest";

import type { AppUser } from "@/features/app-auth-v2/app-user";
import { getCurrentAdminAccess } from "./current-admin-access";

const USER: AppUser = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "operator@example.com",
    status: "active",
    roles: ["admin"],
};

describe("administrator report access", () => {
    it("requires an authenticated administrator role", async () => {
        const resolveUser = vi.fn(async () => USER);
        await expect(getCurrentAdminAccess({
            cookieStore: { get: () => ({ value: "session-token" }) },
            resolveUser,
        })).resolves.toEqual({ kind: "authorized", user: USER });
        expect(resolveUser).toHaveBeenCalledWith("session-token");
    });

    it("distinguishes missing identity from a non-admin account", async () => {
        await expect(getCurrentAdminAccess({
            cookieStore: { get: () => undefined },
            resolveUser: async () => null,
        })).resolves.toEqual({ kind: "missing" });

        const recruiter: AppUser = { ...USER, roles: ["recruiter"] };
        await expect(getCurrentAdminAccess({
            cookieStore: { get: () => ({ value: "session-token" }) },
            resolveUser: async () => recruiter,
        })).resolves.toEqual({ kind: "forbidden", user: recruiter });
    });
});
