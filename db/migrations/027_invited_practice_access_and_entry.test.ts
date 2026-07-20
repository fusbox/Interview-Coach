import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
    join(process.cwd(), "db", "migrations", "027_invited_practice_access_and_entry.sql"),
    "utf8",
).toLowerCase();

describe("invited practice access and entry migration", () => {
    it("stores only hashed browser bearers linked to the invitation token", () => {
        expect(sql).toContain("create table if not exists public.invited_practice_browser_sessions");
        expect(sql).toContain("session_token_hash text not null unique");
        expect(sql).toContain("references public.invited_practice_access_tokens");
        expect(sql).not.toContain("raw_token");
    });

    it("persists immutable first-entry initials evidence without making it identity", () => {
        expect(sql).toContain("create table if not exists public.invited_practice_entry_signals");
        expect(sql).toContain("match_state in ('match', 'mismatch')");
        expect(sql).toContain("invited practice entry signal is immutable");
        expect(sql).not.toContain("authenticated");
    });

    it("prevents browser-session identity mutation and reactivation", () => {
        expect(sql).toContain("invited practice browser session identity is immutable");
        expect(sql).toContain("revoked invited practice browser session cannot be reactivated");
    });
});
