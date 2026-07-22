import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    join(process.cwd(), "db/migrations/031_voice_transcription_claims.sql"),
    "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("voice transcription claims migration", () => {
    it("binds command intent to candidate and invited runs", () => {
        expect(migration).toContain("candidate_voice_transcription_runs add column if not exists submission_path text");
        expect(migration).toContain("invited_practice_voice_transcription_runs add column if not exists submission_path text");
        expect(migration).toContain("submission_path in ('quick_submit', 'transcript_review')");
        expect(migration).toContain("voice transcription submission path is immutable");
    });

    it("refuses to invent intent for existing runs", () => {
        expect(migration).toContain("voice transcription runs must be cleared before applying immutable submission intent");
        expect(migration).not.toContain("update public.candidate_voice_transcription_runs set submission_path");
    });
});
