import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    resolve(process.cwd(), "db/migrations/045_candidate_account_recovery.sql"),
    "utf8",
);

describe("candidate account recovery migration", () => {
    it("issues only app-owned candidate reset tokens with bounded replacement", () => {
        expect(migration).toContain("issue_candidate_password_reset_v1");
        expect(migration).toContain("app_role.role = 'candidate'");
        expect(migration).toContain("profile.workspace = 'interview_coach'");
        expect(migration).toContain("email_verified_at is not null");
        expect(migration).toContain("now() - interval '60 seconds'");
        expect(migration).toContain("update public.password_reset_tokens");
    });

    it("atomically resets credentials and revokes every prior app session", () => {
        expect(migration).toContain("consume_candidate_password_reset_v1");
        expect(migration).toContain("password_updated_at = now()");
        expect(migration).toContain("failed_login_count = 0");
        expect(migration).toContain("locked_until = null");
        expect(migration).toContain("update public.app_sessions");
        expect(migration).toContain("where user_id = v_token.user_id");
        expect(migration).toContain("'revokedSessionCount', v_revoked");
    });

    it("keeps reset tokens hashed, expiring, single-use, and invalidatable", () => {
        expect(migration).toContain("p_token_hash text");
        expect(migration).toContain("v_token.expires_at <= now()");
        expect(migration).toContain("v_token.used_at is not null");
        expect(migration).toContain("invalidate_candidate_password_reset_v1");
        expect(migration).not.toContain("p_raw_token");
    });
});
