import { describe, expect, it, vi } from "vitest";

import type { AppUser } from "../recruiter-auth-v2/app-user";
import {
    createAiEvalOperatorAccessRepository,
    getCurrentAiEvalOperatorAccess,
} from "./ai-eval-operator-access";

const USER: AppUser = {
    id: "user-1",
    email: "operator@example.invalid",
    status: "active",
    roles: ["recruiter", "admin"],
};

describe("AI-eval operator access", () => {
    it("resolves only an active named grant for an active app user", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{
                ai_eval_operator_grant_id: "grant-1",
                user_id: USER.id,
                granted_at: "2026-07-22T10:00:00.000000Z",
            }],
        });
        const repository = createAiEvalOperatorAccessRepository({ query });

        await expect(repository.findActiveGrant(USER.id)).resolves.toEqual({
            grantId: "grant-1",
            userId: USER.id,
            grantedAt: "2026-07-22T10:00:00.000000Z",
        });
        expect(query).toHaveBeenCalledWith(expect.stringContaining("app_user.status = 'active'"), [USER.id]);
        expect(query.mock.calls[0]?.[0]).toContain("operator_grant.lifecycle_state = 'active'");
        expect(query.mock.calls[0]?.[0]).not.toContain("app_user_roles");
    });

    it("does not inherit access from recruiter, admin, or qa roles", async () => {
        const access = await getCurrentAiEvalOperatorAccess({
            cookieStore: { get: () => ({ value: "session-token" }) },
            resolveUser: async () => ({ ...USER, roles: ["recruiter", "admin", "qa"] }),
            resolveGrant: async () => null,
        });

        expect(access).toEqual({
            kind: "forbidden",
            user: { ...USER, roles: ["recruiter", "admin", "qa"] },
        });
    });

    it("authorizes an authenticated app user only when the named grant resolves", async () => {
        const access = await getCurrentAiEvalOperatorAccess({
            cookieStore: { get: () => ({ value: "session-token" }) },
            resolveUser: async () => USER,
            resolveGrant: async (userId) => ({
                grantId: "grant-1",
                userId,
                grantedAt: "2026-07-22T10:00:00.000000Z",
            }),
        });

        expect(access).toMatchObject({ kind: "authorized", user: USER, grant: { grantId: "grant-1" } });
    });

    it("returns missing without consulting the grant store when no app session resolves", async () => {
        const resolveGrant = vi.fn();
        const access = await getCurrentAiEvalOperatorAccess({
            cookieStore: { get: () => undefined },
            resolveUser: async () => null,
            resolveGrant,
        });

        expect(access).toEqual({ kind: "missing" });
        expect(resolveGrant).not.toHaveBeenCalled();
    });
});
