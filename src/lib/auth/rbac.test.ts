import { describe, expect, it } from "vitest";
import type { AppUser } from "./user";
import { isAdmin, isQualityEvaluator, isStaff } from "./rbac";

function user(overrides: Partial<AppUser>): AppUser {
    return {
        id: "user-1",
        email: "user@example.com",
        app_metadata: {},
        user_metadata: {},
        ...overrides,
    };
}

describe("rbac", () => {
    it("keeps admin access separate from ordinary staff access", () => {
        const recruiter = user({ email: "recruiter@example.com" });

        expect(isStaff(recruiter)).toBe(true);
        expect(isAdmin(recruiter)).toBe(false);
        expect(isQualityEvaluator(recruiter)).toBe(false);
    });

    it("lets admins access QA tooling", () => {
        const admin = user({ email: "fu@rangam.com" });

        expect(isAdmin(admin)).toBe(true);
        expect(isQualityEvaluator(admin)).toBe(true);
    });

    it("lets metadata roles grant QA access without admin access", () => {
        const evaluator = user({
            email: "data-science@example.com",
            app_metadata: { roles: ["qa"] },
        });

        expect(isAdmin(evaluator)).toBe(false);
        expect(isQualityEvaluator(evaluator)).toBe(true);
    });

    it("lets allowlisted QA users access QA tooling without admin access", () => {
        const evaluator = user({ email: "kushal@rangam.com" });

        expect(isAdmin(evaluator)).toBe(false);
        expect(isQualityEvaluator(evaluator)).toBe(true);
    });

    it("uses app-owned DB roles when present", () => {
        const admin = user({
            email: "db-admin@example.com",
            roles: ["admin"],
        });
        const evaluator = user({
            email: "db-qa@example.com",
            roles: ["qa"],
        });

        expect(isAdmin(admin)).toBe(true);
        expect(isQualityEvaluator(admin)).toBe(true);
        expect(isAdmin(evaluator)).toBe(false);
        expect(isQualityEvaluator(evaluator)).toBe(true);
    });
});
