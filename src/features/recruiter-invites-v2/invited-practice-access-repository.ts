import type { CandidateSetupStageId } from "@/features/candidate-setup-v2/candidate-setup-contract";
import type { CandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import type { CandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";

export type InvitedPracticeAccessQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

export type InvitedPracticeEntrySignal = {
    enteredInitials: string;
    expectedInitials: string;
    matchState: "match" | "mismatch";
    createdAt: string;
};

export type InvitedPracticeAccessContext = {
    browserSessionId: string;
    browserSessionExpiresAt: string;
    sourceTokenExpiresAt: string;
    sessionId: string;
    sessionAttemptNumber: number;
    recipientId: string;
    recruiterId: string;
    firstName: string;
    lastName: string;
    status: "planned" | "in_progress" | "completed" | "abandoned";
    targetRole: string;
    interviewStage: CandidateSetupStageId;
    questionPlanSnapshot: CandidateQuestionPlan;
    questionWordingSnapshot: CandidateQuestionWordingResult;
    progress: Record<string, unknown>;
    entrySignal: InvitedPracticeEntrySignal | null;
};

export type InvitedPracticeAttemptAdvanceResult = {
    outcome: "created" | "replayed" | "invalid_state" | "stale_parent";
    sessionId: string | null;
    browserSessionExpiresAt: string | null;
};

export function createInvitedPracticeAccessRepository(client: InvitedPracticeAccessQueryClient) {
    return {
        async exchangeInvitationToken(input: {
            invitationTokenHash: string;
            browserSessionId: string;
            browserSessionTokenHash: string;
            requestedExpiresAt: string;
        }): Promise<InvitedPracticeAccessContext | null> {
            const result = await client.query(`
                with eligible as (
                  select
                    token.invited_practice_access_token_id,
                    token.expires_at as source_token_expires_at,
                    token.invited_practice_session_id as source_session_id,
                    session.invited_practice_session_id,
                    session.attempt_number as session_attempt_number,
                    session.recruiter_invitation_recipient_id,
                    session.recruiter_id,
                    session.status,
                    session.question_plan_snapshot_json,
                    session.question_wording_snapshot_json,
                    session.progress_state_json,
                    recipient.first_name,
                    recipient.last_name,
                    batch.target_role,
                    batch.interview_stage
                  from public.invited_practice_access_tokens token
                  join public.invited_practice_sessions source_session
                    on source_session.invited_practice_session_id = token.invited_practice_session_id
                   and source_session.recruiter_invitation_recipient_id = token.recruiter_invitation_recipient_id
                  join public.recruiter_invitation_recipients recipient
                    on recipient.recruiter_invitation_recipient_id = source_session.recruiter_invitation_recipient_id
                   and recipient.recruiter_id = source_session.recruiter_id
                  join public.recruiter_invitation_batches batch
                    on batch.recruiter_invitation_batch_id = recipient.recruiter_invitation_batch_id
                   and batch.recruiter_id = recipient.recruiter_id
                  join lateral (
                    select owned_session.*
                    from public.invited_practice_sessions owned_session
                    where owned_session.recruiter_invitation_recipient_id = recipient.recruiter_invitation_recipient_id
                      and owned_session.recruiter_id = recipient.recruiter_id
                    order by owned_session.attempt_number desc
                    limit 1
                  ) session on true
                  where token.token_hash = $1
                    and token.revoked_at is null
                    and token.expires_at > now()
                    and batch.lifecycle_state = 'ready'
                    and recipient.lifecycle_state = 'ready'
                  limit 1
                ), inserted as (
                  insert into public.invited_practice_browser_sessions (
                    invited_practice_browser_session_id,
                    invited_practice_access_token_id,
                    session_token_hash,
                    expires_at,
                    created_at,
                    last_seen_at
                  )
                  select
                    $2::uuid,
                    eligible.invited_practice_access_token_id,
                    $3,
                    least($4::timestamptz, eligible.source_token_expires_at),
                    now(),
                    now()
                  from eligible
                  where least($4::timestamptz, eligible.source_token_expires_at) > now()
                  returning invited_practice_browser_session_id, invited_practice_access_token_id, expires_at
                )
                select
                  inserted.invited_practice_browser_session_id,
                  inserted.expires_at as browser_session_expires_at,
                  eligible.*,
                  signal.entered_initials,
                  signal.expected_initials,
                  signal.match_state,
                  signal.created_at as signal_created_at
                from inserted
                join eligible
                  on eligible.invited_practice_access_token_id = inserted.invited_practice_access_token_id
                left join public.invited_practice_entry_signals signal
                  on signal.invited_practice_session_id = eligible.source_session_id
                 and signal.recruiter_invitation_recipient_id = eligible.recruiter_invitation_recipient_id
            `, [
                input.invitationTokenHash,
                input.browserSessionId,
                input.browserSessionTokenHash,
                input.requestedExpiresAt,
            ]);

            return mapAccessContext(result.rows[0]);
        },

        async resolveBrowserSession(sessionTokenHash: string): Promise<InvitedPracticeAccessContext | null> {
            const result = await client.query(`
                with eligible as (
                  select
                    browser.invited_practice_browser_session_id,
                    browser.expires_at as browser_session_expires_at,
                    token.expires_at as source_token_expires_at,
                    token.invited_practice_session_id as source_session_id,
                    session.invited_practice_session_id,
                    session.attempt_number as session_attempt_number,
                    session.recruiter_invitation_recipient_id,
                    session.recruiter_id,
                    session.status,
                    session.question_plan_snapshot_json,
                    session.question_wording_snapshot_json,
                    session.progress_state_json,
                    recipient.first_name,
                    recipient.last_name,
                    batch.target_role,
                    batch.interview_stage
                  from public.invited_practice_browser_sessions browser
                  join public.invited_practice_access_tokens token
                    on token.invited_practice_access_token_id = browser.invited_practice_access_token_id
                  join public.invited_practice_sessions source_session
                    on source_session.invited_practice_session_id = token.invited_practice_session_id
                   and source_session.recruiter_invitation_recipient_id = token.recruiter_invitation_recipient_id
                  join public.recruiter_invitation_recipients recipient
                    on recipient.recruiter_invitation_recipient_id = source_session.recruiter_invitation_recipient_id
                   and recipient.recruiter_id = source_session.recruiter_id
                  join public.recruiter_invitation_batches batch
                    on batch.recruiter_invitation_batch_id = recipient.recruiter_invitation_batch_id
                   and batch.recruiter_id = recipient.recruiter_id
                  join lateral (
                    select owned_session.*
                    from public.invited_practice_sessions owned_session
                    where owned_session.recruiter_invitation_recipient_id = recipient.recruiter_invitation_recipient_id
                      and owned_session.recruiter_id = recipient.recruiter_id
                    order by owned_session.attempt_number desc
                    limit 1
                  ) session on true
                  where browser.session_token_hash = $1
                    and browser.revoked_at is null
                    and browser.expires_at > now()
                    and token.revoked_at is null
                    and token.expires_at > now()
                    and batch.lifecycle_state = 'ready'
                    and recipient.lifecycle_state = 'ready'
                  limit 1
                ), touched as (
                  update public.invited_practice_browser_sessions browser
                  set last_seen_at = now()
                  from eligible
                  where browser.invited_practice_browser_session_id = eligible.invited_practice_browser_session_id
                    and browser.last_seen_at < now() - interval '5 minutes'
                  returning browser.invited_practice_browser_session_id
                )
                select
                  eligible.*,
                  signal.entered_initials,
                  signal.expected_initials,
                  signal.match_state,
                  signal.created_at as signal_created_at
                from eligible
                left join public.invited_practice_entry_signals signal
                  on signal.invited_practice_session_id = eligible.source_session_id
                 and signal.recruiter_invitation_recipient_id = eligible.recruiter_invitation_recipient_id
            `, [sessionTokenHash]);

            return mapAccessContext(result.rows[0]);
        },

        async advanceCompletedAttempt(input: {
            currentBrowserSessionTokenHash: string;
            expectedParentSessionId: string;
            newSessionId: string;
            newBrowserSessionId: string;
            newBrowserSessionTokenHash: string;
            requestedExpiresAt: string;
        }): Promise<InvitedPracticeAttemptAdvanceResult | null> {
            const result = await client.query(`
                select *
                from public.advance_invited_practice_attempt($1, $2, $3, $4, $5, $6)
            `, [
                input.currentBrowserSessionTokenHash,
                input.expectedParentSessionId,
                input.newSessionId,
                input.newBrowserSessionId,
                input.newBrowserSessionTokenHash,
                input.requestedExpiresAt,
            ]);
            return mapAttemptAdvanceResult(result.rows[0]);
        },

        async confirmInitials(input: {
            sessionTokenHash: string;
            enteredInitials: string;
        }): Promise<{ signal: InvitedPracticeEntrySignal; firstName: string } | null> {
            const result = await client.query(`
                with eligible as (
                  select
                    session.invited_practice_session_id,
                    session.recruiter_invitation_recipient_id,
                    recipient.first_name,
                    left(upper(left(trim(recipient.first_name), 1)), 1)
                      || left(upper(left(trim(recipient.last_name), 1)), 1) as expected_initials
                  from public.invited_practice_browser_sessions browser
                  join public.invited_practice_access_tokens token
                    on token.invited_practice_access_token_id = browser.invited_practice_access_token_id
                  join public.invited_practice_sessions session
                    on session.invited_practice_session_id = token.invited_practice_session_id
                   and session.recruiter_invitation_recipient_id = token.recruiter_invitation_recipient_id
                  join public.recruiter_invitation_recipients recipient
                    on recipient.recruiter_invitation_recipient_id = session.recruiter_invitation_recipient_id
                   and recipient.recruiter_id = session.recruiter_id
                  join public.recruiter_invitation_batches batch
                    on batch.recruiter_invitation_batch_id = recipient.recruiter_invitation_batch_id
                   and batch.recruiter_id = recipient.recruiter_id
                  where browser.session_token_hash = $1
                    and browser.revoked_at is null
                    and browser.expires_at > now()
                    and token.revoked_at is null
                    and token.expires_at > now()
                    and batch.lifecycle_state = 'ready'
                    and recipient.lifecycle_state = 'ready'
                  limit 1
                ), inserted as (
                  insert into public.invited_practice_entry_signals (
                    invited_practice_session_id,
                    recruiter_invitation_recipient_id,
                    entered_initials,
                    expected_initials,
                    match_state,
                    created_at
                  )
                  select
                    eligible.invited_practice_session_id,
                    eligible.recruiter_invitation_recipient_id,
                    $2,
                    eligible.expected_initials,
                    case when $2 = eligible.expected_initials then 'match' else 'mismatch' end,
                    now()
                  from eligible
                  on conflict (invited_practice_session_id) do update
                    set invited_practice_session_id = excluded.invited_practice_session_id
                  returning *
                ), durable as (
                  select * from inserted
                  union all
                  select signal.*
                  from public.invited_practice_entry_signals signal
                  join eligible
                    on eligible.invited_practice_session_id = signal.invited_practice_session_id
                   and eligible.recruiter_invitation_recipient_id = signal.recruiter_invitation_recipient_id
                  where not exists (select 1 from inserted)
                )
                select durable.*, eligible.first_name
                from durable
                join eligible
                  on eligible.invited_practice_session_id = durable.invited_practice_session_id
                 and eligible.recruiter_invitation_recipient_id = durable.recruiter_invitation_recipient_id
                limit 1
            `, [input.sessionTokenHash, input.enteredInitials]);

            const row = result.rows[0];
            const signal = mapEntrySignal(row);
            return signal && row
                ? { signal, firstName: requireString(row.first_name, "first_name") }
                : null;
        },
    };
}

export type InvitedPracticeAccessRepository = ReturnType<typeof createInvitedPracticeAccessRepository>;

function mapAccessContext(row: Record<string, unknown> | undefined): InvitedPracticeAccessContext | null {
    if (!row) return null;
    return {
        browserSessionId: requireString(row.invited_practice_browser_session_id, "browser_session_id"),
        browserSessionExpiresAt: toIsoString(row.browser_session_expires_at, "browser_session_expires_at"),
        sourceTokenExpiresAt: toIsoString(row.source_token_expires_at, "source_token_expires_at"),
        sessionId: requireString(row.invited_practice_session_id, "invited_practice_session_id"),
        sessionAttemptNumber: readPositiveInteger(row.session_attempt_number, "session_attempt_number"),
        recipientId: requireString(row.recruiter_invitation_recipient_id, "recipient_id"),
        recruiterId: requireString(row.recruiter_id, "recruiter_id"),
        firstName: requireString(row.first_name, "first_name"),
        lastName: requireString(row.last_name, "last_name"),
        status: readStatus(row.status),
        targetRole: requireString(row.target_role, "target_role"),
        interviewStage: readInterviewStage(row.interview_stage),
        questionPlanSnapshot: row.question_plan_snapshot_json as CandidateQuestionPlan,
        questionWordingSnapshot: row.question_wording_snapshot_json as CandidateQuestionWordingResult,
        progress: readObject(row.progress_state_json, "progress_state_json"),
        entrySignal: mapEntrySignal(row),
    };
}

function mapEntrySignal(row: Record<string, unknown> | undefined): InvitedPracticeEntrySignal | null {
    if (!row || row.entered_initials == null) return null;
    const matchState = row.match_state;
    if (matchState !== "match" && matchState !== "mismatch") {
        throw new Error("Invited practice repository returned an invalid match state.");
    }
    return {
        enteredInitials: requireString(row.entered_initials, "entered_initials"),
        expectedInitials: requireString(row.expected_initials, "expected_initials"),
        matchState,
        createdAt: toIsoString(row.signal_created_at ?? row.created_at, "signal_created_at"),
    };
}

function mapAttemptAdvanceResult(
    row: Record<string, unknown> | undefined,
): InvitedPracticeAttemptAdvanceResult | null {
    if (!row) return null;
    const outcome = row.outcome;
    if (
        outcome !== "created"
        && outcome !== "replayed"
        && outcome !== "invalid_state"
        && outcome !== "stale_parent"
    ) throw new Error("Invalid invited practice attempt-advance outcome.");
    const sessionId = typeof row.invited_practice_session_id === "string"
        ? row.invited_practice_session_id
        : null;
    const browserSessionExpiresAt = row.browser_session_expires_at == null
        ? null
        : toIsoString(row.browser_session_expires_at, "browser_session_expires_at");
    if ((outcome === "created" || outcome === "replayed") && (!sessionId || !browserSessionExpiresAt)) {
        throw new Error("Invited practice attempt advance returned incomplete browser-session material.");
    }
    return { outcome, sessionId, browserSessionExpiresAt };
}

function requireString(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${field}.`);
    return value;
}

function readObject(value: unknown, field: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${field}.`);
    return value as Record<string, unknown>;
}

function readStatus(value: unknown): InvitedPracticeAccessContext["status"] {
    if (value === "planned" || value === "in_progress" || value === "completed" || value === "abandoned") return value;
    throw new Error("Invalid invited practice status.");
}

function readInterviewStage(value: unknown): CandidateSetupStageId {
    if (
        value === "practice_only"
        || value === "screening"
        || value === "first_interview"
        || value === "follow_up"
        || value === "final_interview"
    ) return value;
    throw new Error("Invalid invited practice interview stage.");
}

function readPositiveInteger(value: unknown, field: string) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(number) || number < 1) throw new Error(`Invalid ${field}.`);
    return number;
}

function toIsoString(value: unknown, field: string) {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.valueOf())) throw new Error(`Invalid ${field}.`);
    return date.toISOString();
}
