import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    resolve(process.cwd(), "db/migrations/050_voice_runtime_hash_compatibility.sql"),
    "utf8",
);
const candidateRepository = readFileSync(
    resolve(process.cwd(), "src/features/candidate-session-v2/candidate-answer-history-repository.ts"),
    "utf8",
);
const invitedRepository = readFileSync(
    resolve(process.cwd(), "src/features/recruiter-invites-v2/invited-practice-answer-history-repository.ts"),
    "utf8",
);

describe("voice runtime hash compatibility migration", () => {
    it("resolves pgcrypto behind one fixed-search-path security-definer wrapper", () => {
        expect(migration).toContain("function public.interview_coach_sha256_text(value text)");
        expect(migration).toContain("security definer");
        expect(migration).toContain("set search_path = pg_catalog, public, pg_temp");
        expect(migration).toContain("where extension.extname = 'pgcrypto'");
        expect(migration).toContain("format(");
        expect(migration).toContain("%I.digest($1, $2)");
        expect(migration).not.toContain("grant usage on schema extensions");
        expect(migration).not.toContain("alter role interview_coach_runtime set search_path");
    });

    it("allows only the runtime hash wrapper and moves both voice paths onto it", () => {
        expect(migration).toContain("from public");
        expect(migration).toContain("to interview_coach_runtime");
        expect(migration).toContain("validate_candidate_answer_attempt_voice_source");
        expect(migration).toContain("validate_invited_answer_attempt_voice_source");
        expect(migration.match(/public\.interview_coach_sha256_text/g)?.length).toBeGreaterThan(4);
        expect(candidateRepository).toContain("public.interview_coach_sha256_text(trim($7))");
        expect(invitedRepository).toContain("public.interview_coach_sha256_text(trim($7))");
        expect(candidateRepository).not.toContain("encode(digest(");
        expect(invitedRepository).not.toContain("encode(digest(");
    });
});
