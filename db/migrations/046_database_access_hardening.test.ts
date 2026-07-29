import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    resolve(process.cwd(), "db/migrations/046_database_access_hardening.sql"),
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
