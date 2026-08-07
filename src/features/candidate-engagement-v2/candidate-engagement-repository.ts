import type {
    CandidateEngagementReportRow,
    CandidateEngagementSessionSummary,
    CandidateEngagementSlice,
} from "./candidate-engagement-contract";

export type CandidateEngagementQueryClient = {
    query: (sql: string, values?: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export type AppendCandidateEngagementSlicesResult = CandidateEngagementSessionSummary & {
    sessionOwned: boolean;
    acceptedSliceCount: number;
};

export function createCandidateEngagementRepository(client: CandidateEngagementQueryClient) {
    return {
        async appendSlices(input: {
            candidatePracticeSessionId: string;
            candidateProfileId: string;
            slices: CandidateEngagementSlice[];
        }): Promise<AppendCandidateEngagementSlicesResult> {
            const result = await client.query(`
                with owned_session as materialized (
                  select 1
                  from public.candidate_practice_sessions session
                  where session.candidate_practice_session_id = $1
                    and session.candidate_profile_id = $2
                ), payload as materialized (
                  select
                    item.engagement_slice_id,
                    item.tracker_instance_id,
                    item.sequence_number,
                    item.active_milliseconds,
                    item.client_started_at,
                    item.client_ended_at,
                    item.opened_by,
                    item.last_activity,
                    item.flush_reason
                  from jsonb_to_recordset($3::jsonb) as item(
                    engagement_slice_id uuid,
                    tracker_instance_id uuid,
                    sequence_number integer,
                    active_milliseconds integer,
                    client_started_at timestamptz,
                    client_ended_at timestamptz,
                    opened_by text,
                    last_activity text,
                    flush_reason text
                  )
                ), inserted as (
                  insert into public.candidate_engagement_slices (
                    candidate_engagement_slice_id,
                    candidate_practice_session_id,
                    candidate_profile_id,
                    tracker_instance_id,
                    sequence_number,
                    active_milliseconds,
                    client_started_at,
                    client_ended_at,
                    opened_by,
                    last_activity,
                    flush_reason
                  )
                  select
                    payload.engagement_slice_id,
                    $1,
                    $2,
                    payload.tracker_instance_id,
                    payload.sequence_number,
                    payload.active_milliseconds,
                    payload.client_started_at,
                    payload.client_ended_at,
                    payload.opened_by,
                    payload.last_activity,
                    payload.flush_reason
                  from payload
                  where exists (select 1 from owned_session)
                  on conflict do nothing
                  returning active_milliseconds
                )
                select
                  exists (select 1 from owned_session) as session_owned,
                  (select count(*)::integer from inserted) as accepted_slice_count,
                  coalesce(sum(slice.active_milliseconds), 0)::bigint as active_milliseconds,
                  count(slice.candidate_engagement_slice_id)::integer as slice_count,
                  min(slice.received_at) as first_received_at,
                  max(slice.received_at) as last_received_at
                from public.candidate_engagement_slices slice
                where slice.candidate_practice_session_id = $1
                  and slice.candidate_profile_id = $2
            `, [
                input.candidatePracticeSessionId,
                input.candidateProfileId,
                JSON.stringify(input.slices.map(toPersistenceSlice)),
            ]);

            const row = result.rows[0];
            return {
                sessionOwned: row?.session_owned === true,
                acceptedSliceCount: readNumber(row?.accepted_slice_count),
                ...toSummary(row),
            };
        },

        async getSessionSummary(input: {
            candidatePracticeSessionId: string;
            candidateProfileId: string;
        }): Promise<CandidateEngagementSessionSummary | null> {
            const result = await client.query(`
                select
                  coalesce(sum(slice.active_milliseconds), 0)::bigint as active_milliseconds,
                  count(slice.candidate_engagement_slice_id)::integer as slice_count,
                  min(slice.received_at) as first_received_at,
                  max(slice.received_at) as last_received_at
                from public.candidate_practice_sessions session
                left join public.candidate_engagement_slices slice
                  on slice.candidate_practice_session_id = session.candidate_practice_session_id
                 and slice.candidate_profile_id = session.candidate_profile_id
                where session.candidate_practice_session_id = $1
                  and session.candidate_profile_id = $2
                group by session.candidate_practice_session_id
            `, [input.candidatePracticeSessionId, input.candidateProfileId]);

            return result.rows[0] ? toSummary(result.rows[0]) : null;
        },

        async listAdminReport(input: { limit?: number } = {}): Promise<CandidateEngagementReportRow[]> {
            const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
            const result = await client.query(`
                select
                  session.candidate_practice_session_id,
                  coalesce(nullif(trim(profile.display_name), ''), 'Candidate') as candidate_label,
                  case
                    when profile.email ~ '^[^@]+@[^@]+$' then
                      left(
                        split_part(profile.email, '@', 1),
                        least(2, length(split_part(profile.email, '@', 1)))
                      ) || '••••' || '@' || split_part(profile.email, '@', 2)
                    else 'Unavailable'
                  end as masked_email,
                  coalesce(nullif(trim(session.setup_snapshot_json ->> 'targetRole'), ''), 'Role not available') as target_role,
                  session.status,
                  session.created_at as session_created_at,
                  coalesce(sum(slice.active_milliseconds), 0)::bigint as active_milliseconds,
                  count(slice.candidate_engagement_slice_id)::integer as slice_count,
                  min(slice.received_at) as first_received_at,
                  max(slice.received_at) as last_received_at
                from public.candidate_practice_sessions session
                join public.candidate_profiles profile
                  on profile.candidate_profile_id = session.candidate_profile_id
                join public.candidate_engagement_slices slice
                  on slice.candidate_practice_session_id = session.candidate_practice_session_id
                 and slice.candidate_profile_id = session.candidate_profile_id
                group by
                  session.candidate_practice_session_id,
                  profile.display_name,
                  profile.email,
                  session.setup_snapshot_json,
                  session.status,
                  session.created_at
                order by max(slice.received_at) desc, session.created_at desc
                limit $1
            `, [limit]);

            return result.rows.map((row) => ({
                candidatePracticeSessionId: readString(row.candidate_practice_session_id),
                candidateLabel: readString(row.candidate_label) || "Candidate",
                maskedEmail: readString(row.masked_email) || "Unavailable",
                targetRole: readString(row.target_role) || "Role not available",
                sessionStatus: readSessionStatus(row.status),
                sessionCreatedAt: readIso(row.session_created_at) ?? new Date(0).toISOString(),
                ...toSummary(row),
            }));
        },
    };
}

function toPersistenceSlice(slice: CandidateEngagementSlice) {
    return {
        engagement_slice_id: slice.engagementSliceId,
        tracker_instance_id: slice.trackerInstanceId,
        sequence_number: slice.sequenceNumber,
        active_milliseconds: slice.activeMilliseconds,
        client_started_at: slice.clientStartedAt,
        client_ended_at: slice.clientEndedAt,
        opened_by: slice.openedBy,
        last_activity: slice.lastActivity,
        flush_reason: slice.flushReason,
    };
}

function toSummary(row: Record<string, unknown> | undefined): CandidateEngagementSessionSummary {
    return {
        activeMilliseconds: readNumber(row?.active_milliseconds),
        sliceCount: readNumber(row?.slice_count),
        firstReceivedAt: readIso(row?.first_received_at),
        lastReceivedAt: readIso(row?.last_received_at),
    };
}

function readString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

function readIso(value: unknown) {
    if (value instanceof Date && Number.isFinite(value.valueOf())) return value.toISOString();
    if (typeof value !== "string") return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function readSessionStatus(value: unknown): CandidateEngagementReportRow["sessionStatus"] {
    return value === "in_progress" || value === "completed" || value === "abandoned"
        ? value
        : "planned";
}
