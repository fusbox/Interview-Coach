import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const sql = fs.readFileSync(
    path.join(process.cwd(), "db/migrations/047_candidate_question_assistance_artifacts.sql"),
    "utf8",
);

describe("candidate question assistance artifact migration", () => {
    it("creates a candidate-owned durable artifact boundary", () => {
        expect(sql).toContain("create table if not exists public.candidate_question_assistance_artifacts");
        expect(sql).toContain("create table if not exists public.invited_question_assistance_artifacts");
        expect(sql).toContain("foreign key (candidate_practice_session_id, candidate_profile_id)");
        expect(sql).toContain("foreign key (invited_practice_session_id, recruiter_invitation_recipient_id)");
        expect(sql).toContain("unique (");
        expect(sql).toContain("assistance_kind in ('hints', 'strong_response')");
    });

    it("supports leased generation, replay, and runtime hardening", () => {
        expect(sql).toContain("claim_token uuid");
        expect(sql).toContain("claim_expires_at timestamptz");
        expect(sql).toContain("lifecycle_state in ('pending', 'succeeded', 'failed')");
        expect(sql).toContain("enable row level security");
        expect(sql).toContain("to interview_coach_runtime");
    });
});
