import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    resolve(process.cwd(), "db/migrations/046_database_access_hardening.sql"),
    "utf8",
);
const validation = readFileSync(
    resolve(process.cwd(), "db/validation/032_database_access_hardening_smoke.sql"),
    "utf8",
);
const provisioner = readFileSync(
    resolve(process.cwd(), "scripts/provision-postgres-runtime-role.mjs"),
    "utf8",
);

describe("database access hardening migration", () => {
    it("creates a non-owner runtime role without bypass privileges", () => {
        expect(migration).toContain("create role interview_coach_runtime");
        expect(migration).toContain("nobypassrls");
        expect(migration).toContain("nocreaterole");
        expect(migration).toContain("nologin");
        expect(migration).not.toContain("password '");
    });

    it("does not ask Supabase's non-superuser operator to change reserved role attributes", () => {
        expect(migration).toContain(
            "raise exception 'interview_coach_runtime has superuser-only privileges'",
        );
        expect(migration).toContain("alter role interview_coach_runtime set statement_timeout = '15s'");
        expect(migration).not.toMatch(
            /alter role interview_coach_runtime\s+nosuperuser/,
        );
    });

    it("proves runtime access through a real login instead of owner impersonation", () => {
        expect(validation).not.toContain("set local role interview_coach_runtime");
        expect(provisioner).toContain(
            "(select count(*) >= 0 from public.app_users) as runtime_read_probe",
        );
    });

    it("provisions the login and its session defaults atomically", () => {
        expect(provisioner).toContain('await adminClient.query("begin")');
        expect(provisioner).toContain('await adminClient.query("commit")');
        expect(provisioner).toContain('await adminClient.query("rollback")');
    });

    it("removes public and Supabase Data API object access", () => {
        expect(migration).toContain("revoke all privileges on all tables in schema public from public");
        expect(migration).toContain("revoke all privileges on all functions in schema public from public");
        expect(migration).toContain("array['anon', 'authenticated', 'service_role', 'authenticator']");
        expect(migration).toContain("alter default privileges in schema public");
    });

    it("enables RLS without inventing Supabase Auth ownership", () => {
        expect(migration).toContain("alter table %I.%I enable row level security");
        expect(migration).toContain("for all to interview_coach_runtime using (true) with check (true)");
        expect(migration).not.toContain("auth.uid()");
    });

    it("locks down security-definer resolution and direct execution", () => {
        expect(migration).toContain(
            "alter function %s set search_path = pg_catalog, public, pg_temp",
        );
        expect(migration).toContain("v_allowed_names constant text[]");
        expect(migration).toContain(
            "grant execute on function %s to interview_coach_runtime",
        );
        expect(migration).not.toContain(
            "grant execute on all functions in schema public to interview_coach_runtime",
        );
    });
});
