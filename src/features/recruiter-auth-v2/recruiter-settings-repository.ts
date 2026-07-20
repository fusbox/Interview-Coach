import type { RecruiterSettings } from "./recruiter-settings-contract";

export type RecruiterSettingsQueryClient = {
    query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

export type RecruiterSettingsUpdateOutcome =
    | { outcome: "updated" | "unchanged"; settings: RecruiterSettings }
    | { outcome: "conflict" }
    | { outcome: "not_found" };

export function createRecruiterSettingsRepository(client: RecruiterSettingsQueryClient) {
    return {
        async findOwnedSettings(userId: string): Promise<RecruiterSettings | null> {
            const result = await client.query(`
                select
                  app_user.email,
                  app_user.display_name,
                  to_char(
                    app_user.updated_at at time zone 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                  ) as revision
                from public.app_users app_user
                where app_user.user_id = $1
                  and app_user.status = 'active'
                  and exists (
                    select 1
                    from public.app_user_roles role
                    where role.user_id = app_user.user_id
                      and role.role in ('recruiter', 'admin')
                  )
                limit 1
            `, [userId]);
            return mapSettings(result.rows[0]);
        },

        async updateOwnedSettings(input: {
            userId: string;
            senderDisplayName: string;
            revision: string;
        }): Promise<RecruiterSettingsUpdateOutcome> {
            const result = await client.query(`
                with eligible as materialized (
                  select
                    app_user.user_id,
                    app_user.email,
                    app_user.display_name,
                    app_user.updated_at
                  from public.app_users app_user
                  where app_user.user_id = $1
                    and app_user.status = 'active'
                    and exists (
                      select 1
                      from public.app_user_roles role
                      where role.user_id = app_user.user_id
                        and role.role in ('recruiter', 'admin')
                    )
                  limit 1
                ), updated as (
                  update public.app_users app_user
                  set display_name = $2
                  from eligible
                  where app_user.user_id = eligible.user_id
                    and eligible.updated_at = $3::timestamptz
                    and eligible.display_name is distinct from $2
                  returning app_user.user_id, app_user.email, app_user.display_name, app_user.updated_at
                ), audited as (
                  insert into public.auth_audit_events (
                    user_id,
                    event_type,
                    outcome,
                    metadata
                  )
                  select
                    updated.user_id,
                    'recruiter_display_name_updated',
                    'success',
                    jsonb_build_object('fields', jsonb_build_array('display_name'))
                  from updated
                  returning event_id
                )
                select
                  case
                    when updated.user_id is not null then 'updated'
                    when eligible.display_name is not distinct from $2 then 'unchanged'
                    else 'conflict'
                  end as outcome,
                  coalesce(updated.email, eligible.email) as email,
                  coalesce(updated.display_name, eligible.display_name) as display_name,
                  to_char(
                    coalesce(updated.updated_at, eligible.updated_at) at time zone 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                  ) as revision,
                  (select count(*) from audited) as audit_count
                from eligible
                left join updated on true
            `, [input.userId, input.senderDisplayName, input.revision]);
            const row = result.rows[0];
            if (!row) return { outcome: "not_found" };
            if (row.outcome === "conflict") return { outcome: "conflict" };
            if (row.outcome !== "updated" && row.outcome !== "unchanged") {
                throw new Error("Recruiter settings update returned an invalid outcome.");
            }
            if (row.outcome === "updated" && Number(row.audit_count) !== 1) {
                throw new Error("Recruiter settings update did not persist its audit event.");
            }
            const settings = mapSettings(row);
            if (!settings) throw new Error("Recruiter settings update returned invalid settings.");
            return { outcome: row.outcome, settings };
        },
    };
}

function mapSettings(row: Record<string, unknown> | undefined): RecruiterSettings | null {
    if (!row) return null;
    const email = readString(row.email);
    const revision = readString(row.revision);
    if (!email || !revision) return null;
    return {
        senderDisplayName: readString(row.display_name),
        email,
        revision,
    };
}

function readString(value: unknown) {
    return typeof value === "string" ? value : "";
}
