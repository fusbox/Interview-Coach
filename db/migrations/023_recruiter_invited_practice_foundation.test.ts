import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
    process.cwd(),
    "db",
    "migrations",
    "023_recruiter_invited_practice_foundation.sql",
);

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("recruiter invited-practice foundation migration", () => {
    it("separates recruiter ownership, invite-scoped recipients, sessions, and access tokens", () => {
        const sql = migrationSql();
        expect(sql).toContain("create table if not exists public.recruiter_invitation_batches");
        expect(sql).toContain("create table if not exists public.recruiter_invitation_recipients");
        expect(sql).toContain("create table if not exists public.invited_practice_sessions");
        expect(sql).toContain("create table if not exists public.invited_practice_access_tokens");
        expect(sql).toContain("foreign key (invited_practice_session_id, recruiter_invitation_recipient_id)");
        expect(sql).toContain("answer_idempotency_json jsonb not null default '{}'::jsonb");
        expect(sql).toContain("token_hash text not null unique");
        expect(sql).toContain("token_ciphertext text not null");
        expect(sql).not.toContain("insert into public.candidate_profiles");
        expect(sql).not.toContain("insert into public.candidate_practice_sessions");
        expect(sql).not.toContain("insert into public.sessions");
    });

    it("enforces immutable recruiter ownership and recipient-scoped attempt lineage", () => {
        const sql = migrationSql();
        expect(sql).toContain("recruiter invitation ownership is immutable");
        expect(sql).toContain("invited practice session identity and source snapshots are immutable");
        expect(sql).toContain("prior.recruiter_invitation_recipient_id = new.recruiter_invitation_recipient_id");
        expect(sql).toContain("prior.attempt_number = new.attempt_number - 1");
        expect(sql).toContain("unique (recruiter_invitation_recipient_id, attempt_number)");
    });

    it("creates one atomic recruiter-scoped aggregate with replay and conflict outcomes", () => {
        const sql = migrationSql();
        expect(sql).toContain("create table if not exists public.recruiter_invitation_creation_requests");
        expect(sql).toContain("primary key (recruiter_id, idempotency_key_hash)");
        expect(sql).toContain("create or replace function public.create_recruiter_invitation_aggregate(");
        expect(sql).toContain("pg_advisory_xact_lock");
        expect(sql).toContain("'replayed'::text");
        expect(sql).toContain("'conflict'::text");
        expect(sql).toContain("v_created_at + interval '24 hours'");
        expect(sql).toContain("active recruiter authorization required");
    });
});
