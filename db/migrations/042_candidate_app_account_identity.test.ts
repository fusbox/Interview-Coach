import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    resolve(process.cwd(), "db/migrations/042_candidate_app_account_identity.sql"),
    "utf8",
);

describe("candidate app-account identity migration", () => {
    it("adds candidate as an app-owned account audience", () => {
        expect(migration).toContain("check (role in ('candidate', 'recruiter', 'admin', 'qa'))");
    });

    it("binds at most one candidate profile to an app user without touching host profiles", () => {
        expect(migration).toContain("add column if not exists app_user_id uuid");
        expect(migration).toContain("references public.app_users(user_id) on delete set null");
        expect(migration).toContain("create unique index if not exists ux_candidate_profiles_app_user_id");
        expect(migration).toContain("where app_user_id is not null");
    });

    it("distinguishes app-owned profiles from platform workspaces", () => {
        expect(migration).toContain(
            "workspace in ('interview_coach', 'rangamworks', 'talentarbor', 'local_dev')",
        );
        expect(migration).toContain("(app_user_id is not null and workspace = 'interview_coach')");
        expect(migration).toContain("(app_user_id is null and workspace <> 'interview_coach')");
    });
});
