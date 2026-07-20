import { describe, expect, it, vi } from "vitest";

import { createInvitedPracticeAccessRepository } from "./invited-practice-access-repository";

describe("invited practice access repository", () => {
    it("exchanges only active invited aggregates and caps browser expiry to the source token", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [contextRow()] });
        const repository = createInvitedPracticeAccessRepository({ query });

        await expect(repository.exchangeInvitationToken({
            invitationTokenHash: "a".repeat(64),
            browserSessionId: "10000000-0000-4000-8000-000000000001",
            browserSessionTokenHash: "b".repeat(64),
            requestedExpiresAt: "2026-07-27T00:00:00.000Z",
        })).resolves.toMatchObject({
            sessionId: "30000000-0000-4000-8000-000000000001",
            entrySignal: null,
        });

        const [sql, values] = query.mock.calls[0];
        expect(sql).toContain("token.token_hash = $1");
        expect(sql).toContain("token.revoked_at is null");
        expect(sql).toContain("token.expires_at > now()");
        expect(sql).toContain("least($4::timestamptz, eligible.source_token_expires_at)");
        expect(sql).toContain("order by owned_session.attempt_number desc");
        expect(sql).toContain("signal.invited_practice_session_id = eligible.source_session_id");
        expect(sql).not.toContain("candidate_profiles");
        expect(sql).not.toContain("candidate_launch_sessions");
        expect(values).not.toContain("raw-token");
    });

    it("resolves clean-route access through both active browser and source-token lifetimes", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [contextRow({
            entered_initials: "IC",
            expected_initials: "IC",
            match_state: "match",
            signal_created_at: new Date("2026-07-20T00:03:00.000Z"),
        })] });
        const repository = createInvitedPracticeAccessRepository({ query });

        await expect(repository.resolveBrowserSession("b".repeat(64))).resolves.toMatchObject({
            firstName: "Irma",
            entrySignal: { matchState: "match" },
        });
        const [sql] = query.mock.calls[0];
        expect(sql).toContain("browser.revoked_at is null");
        expect(sql).toContain("browser.expires_at > now()");
        expect(sql).toContain("token.expires_at > now()");
        expect(sql).toContain("browser.last_seen_at < now() - interval '5 minutes'");
        expect(sql).toContain("order by owned_session.attempt_number desc");
    });

    it("advances completed practice only through the database-owned transition", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [{
            outcome: "replayed",
            invited_practice_session_id: "30000000-0000-4000-8000-000000000002",
            browser_session_expires_at: new Date("2026-07-27T00:00:00.000Z"),
        }] });
        const repository = createInvitedPracticeAccessRepository({ query });

        await expect(repository.advanceCompletedAttempt({
            currentBrowserSessionTokenHash: "b".repeat(64),
            expectedParentSessionId: "30000000-0000-4000-8000-000000000001",
            newSessionId: "30000000-0000-4000-8000-000000000003",
            newBrowserSessionId: "10000000-0000-4000-8000-000000000002",
            newBrowserSessionTokenHash: "c".repeat(64),
            requestedExpiresAt: "2026-07-27T00:00:00.000Z",
        })).resolves.toEqual({
            outcome: "replayed",
            sessionId: "30000000-0000-4000-8000-000000000002",
            browserSessionExpiresAt: "2026-07-27T00:00:00.000Z",
        });
        expect(query.mock.calls[0][0]).toContain("public.advance_invited_practice_attempt($1, $2, $3, $4, $5, $6)");
    });

    it("makes the first initials signal win under retries or concurrent tabs", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [{
            entered_initials: "XX",
            expected_initials: "IC",
            match_state: "mismatch",
            created_at: new Date("2026-07-20T00:03:00.000Z"),
            first_name: "Irma",
        }] });
        const repository = createInvitedPracticeAccessRepository({ query });

        await expect(repository.confirmInitials({
            sessionTokenHash: "b".repeat(64),
            enteredInitials: "IC",
        })).resolves.toEqual({
            firstName: "Irma",
            signal: {
                enteredInitials: "XX",
                expectedInitials: "IC",
                matchState: "mismatch",
                createdAt: "2026-07-20T00:03:00.000Z",
            },
        });
        const [sql] = query.mock.calls[0];
        expect(sql).toContain("on conflict (invited_practice_session_id) do update");
        expect(sql).toContain("case when $2 = eligible.expected_initials then 'match' else 'mismatch' end");
        expect(sql).not.toContain("update public.invited_practice_entry_signals");
    });
});

function contextRow(overrides: Record<string, unknown> = {}) {
    return {
        invited_practice_browser_session_id: "10000000-0000-4000-8000-000000000001",
        browser_session_expires_at: new Date("2026-07-27T00:00:00.000Z"),
        source_token_expires_at: new Date("2026-08-03T00:00:00.000Z"),
        invited_practice_session_id: "30000000-0000-4000-8000-000000000001",
        session_attempt_number: 1,
        recruiter_invitation_recipient_id: "40000000-0000-4000-8000-000000000001",
        recruiter_id: "20000000-0000-4000-8000-000000000001",
        first_name: "Irma",
        last_name: "Castillo",
        status: "planned",
        target_role: "Quality Inspector",
        interview_stage: "screening",
        question_plan_snapshot_json: {
            interviewStage: "screening",
            questionCount: 1,
            categoryCounts: {},
            slots: [],
        },
        question_wording_snapshot_json: { status: "questions_worded", questions: [] },
        progress_state_json: { status: "planned", currentQuestionIndex: 0 },
        entered_initials: null,
        ...overrides,
    };
}
