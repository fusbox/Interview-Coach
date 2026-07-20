import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    join(process.cwd(), "db/migrations/028_invited_practice_live_runtime.sql"),
    "utf8",
);

describe("invited practice live runtime migration", () => {
    it("binds attempts to the exact invited session and recipient", () => {
        expect(migration).toContain("foreign key (invited_practice_session_id, recruiter_invitation_recipient_id)");
        expect(migration).toContain("references public.invited_practice_sessions");
        expect(migration).toContain("invited answer retry must supersede the immediately prior attempt");
        expect(migration).toContain("invited practice answer attempts are immutable after insertion");
    });

    it("fences resolved evaluator generations and accepted coaching", () => {
        expect(migration).toContain("configurationStatus' = 'resolved");
        expect(migration).toContain("claim_expires_at = requested_at + interval '60 seconds'");
        expect(migration).toContain("uq_invited_practice_answer_evaluation_requested_coaching");
        expect(migration).toContain("uq_invited_practice_answer_evaluation_completed_coaching");
        expect(migration).toContain("requested-to-terminal transition");
    });
});
