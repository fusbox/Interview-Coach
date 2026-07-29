import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    resolve(process.cwd(), "db/migrations/043_candidate_app_account_lifecycle.sql"),
    "utf8",
);

describe("candidate app-account lifecycle migration", () => {
    it("keeps profile, contact state, and immutable consent evidence separate", () => {
        expect(migration).toContain("create table if not exists public.candidate_account_profiles");
        expect(migration).toContain("create table if not exists public.candidate_contact_preferences");
        expect(migration).toContain("create table if not exists public.candidate_consent_receipts");
        expect(migration).toContain("candidate consent receipts are immutable");
        expect(migration).toContain("before update or delete on public.candidate_consent_receipts");
    });

    it("atomically creates one app-owned identity and hashed verification token", () => {
        expect(migration).toContain("register_candidate_app_account_v1");
        expect(migration).toContain("pg_advisory_xact_lock");
        expect(migration).toContain("insert into public.app_user_credentials");
        expect(migration).toContain("insert into public.app_user_roles");
        expect(migration).toContain("insert into public.candidate_profiles");
        expect(migration).toContain("insert into public.email_verification_tokens");
        expect(migration).toContain("'exists'::text");
    });

    it("makes resend bounded and verification explicit and replay-safe", () => {
        expect(migration).toContain("issue_candidate_email_verification_v1");
        expect(migration).toContain("now() - interval '60 seconds'");
        expect(migration).toContain("consume_candidate_email_verification_v1");
        expect(migration).toContain("'already_verified'::text");
        expect(migration).toContain("invalidate_candidate_email_verification_v1");
    });

    it("does not promote phone into an authenticator", () => {
        expect(migration).toContain("phone_verified_at timestamptz");
        expect(migration).not.toContain("phone_verification_tokens");
        expect(migration).not.toContain("sms_verification_tokens");
    });
});
