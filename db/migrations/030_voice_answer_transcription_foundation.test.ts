import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    join(process.cwd(), "db/migrations/030_voice_answer_transcription_foundation.sql"),
    "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("voice answer transcription foundation migration", () => {
    it("keeps candidate and invited transcription ownership separate", () => {
        expect(migration).toContain("create table if not exists public.candidate_voice_transcription_runs");
        expect(migration).toContain("foreign key (candidate_practice_session_id, candidate_profile_id)");
        expect(migration).toContain("create table if not exists public.invited_practice_voice_transcription_runs");
        expect(migration).toContain("foreign key (invited_practice_session_id, recruiter_invitation_recipient_id)");
        expect(migration).toContain("requires an active same-owner question slot");
        expect(migration).toContain("requires an active same-recipient question slot");
        expect(migration).not.toContain("audience_owner_type");
    });

    it("stores only transcription metadata and one recoverable session projection", () => {
        expect(migration).toContain("voice_transcript_drafts_json jsonb not null default '{}'::jsonb");
        expect(migration).toContain("audio_input_fingerprint text not null");
        expect(migration).toContain("output_fingerprint text");
        expect(migration).not.toMatch(/create table[\s\S]+raw_audio/);
        expect(migration).not.toMatch(/create table[\s\S]+transcript_text/);
    });

    it("enforces one terminal transition and exact answer source lineage", () => {
        expect(migration).toContain("requested-to-terminal transition");
        expect(migration).toContain("source_candidate_voice_transcription_run_id");
        expect(migration).toContain("source_invited_voice_transcription_run_id");
        expect(migration).toContain("voice_submission_path in ('quick_submit', 'transcript_review')");
        expect(migration).toContain("mode <> 'voice'");
        expect(migration).toContain("fk_candidate_answer_attempt_voice_source");
        expect(migration).toContain("fk_invited_answer_attempt_voice_source");
        expect(migration).toContain("requires a completed same-owner transcription source");
        expect(migration).toContain("requires a completed same-recipient transcription source");
        expect(migration).toContain("digest(trim(new.answer_text), 'sha256')");
        expect(migration).toContain("quick-submit transcript must match");
    });
});
