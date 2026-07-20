import type { AppUser, AppUserStatus } from "./app-user";
import {
    type AppAuthStore,
    type AuthAuditEvent,
    type CreateAppSessionInput,
    type PasswordCredentialRecord,
    normalizeAppRoles,
    normalizeAuthEmail,
} from "./app-auth-store";
import {
    createRecruiterAuthQueryClientFromEnv,
    type RecruiterAuthQueryClient,
} from "./recruiter-auth-postgres-runtime";

const FAILED_LOGIN_LIMIT = 10;
const LOGIN_LOCK_MINUTES = 15;

export class PostgresAppAuthStore implements AppAuthStore {
    constructor(
        private readonly client: RecruiterAuthQueryClient = createRecruiterAuthQueryClientFromEnv(),
    ) {}

    async findPasswordCredentialByEmail(email: string): Promise<PasswordCredentialRecord | null> {
        const result = await this.client.query(
            `
                select
                    u.user_id,
                    u.email,
                    u.display_name,
                    u.first_name,
                    u.last_name,
                    u.status,
                    c.password_hash,
                    c.failed_login_count,
                    c.locked_until,
                    coalesce(array_agg(r.role) filter (where r.role is not null), '{}') as roles
                from public.app_users u
                join public.app_user_credentials c on c.user_id = u.user_id
                left join public.app_user_roles r on r.user_id = u.user_id
                where lower(u.email) = $1
                group by
                    u.user_id,
                    u.email,
                    u.display_name,
                    u.first_name,
                    u.last_name,
                    u.status,
                    c.password_hash,
                    c.failed_login_count,
                    c.locked_until
                limit 1
            `,
            [normalizeAuthEmail(email)],
        );
        const row = result.rows[0];
        if (!row) return null;

        return {
            user: mapUser(row),
            passwordHash: requireString(row.password_hash, "password_hash"),
            failedLoginCount: readNumber(row.failed_login_count),
            lockedUntil: toIsoString(row.locked_until),
        };
    }

    async findUserBySessionTokenHash(sessionTokenHash: string): Promise<AppUser | null> {
        const result = await this.client.query(
            `
                with valid_session as (
                    select s.session_id, s.user_id
                    from public.app_sessions s
                    join public.app_users u on u.user_id = s.user_id
                    where s.session_token_hash = $1
                      and s.revoked_at is null
                      and s.expires_at > now()
                      and u.status = 'active'
                    limit 1
                ), touched_session as (
                    update public.app_sessions s
                    set last_seen_at = now()
                    from valid_session v
                    where s.session_id = v.session_id
                      and (s.last_seen_at is null or s.last_seen_at < now() - interval '5 minutes')
                    returning s.session_id
                )
                select
                    u.user_id,
                    u.email,
                    u.display_name,
                    u.first_name,
                    u.last_name,
                    u.status,
                    coalesce(array_agg(r.role) filter (where r.role is not null), '{}') as roles
                from valid_session s
                join public.app_users u on u.user_id = s.user_id
                left join public.app_user_roles r on r.user_id = u.user_id
                group by
                    u.user_id,
                    u.email,
                    u.display_name,
                    u.first_name,
                    u.last_name,
                    u.status
                limit 1
            `,
            [sessionTokenHash],
        );

        return result.rows[0] ? mapUser(result.rows[0]) : null;
    }

    async createSession(input: CreateAppSessionInput): Promise<void> {
        await this.client.query(
            `
                insert into public.app_sessions (
                    user_id,
                    session_token_hash,
                    expires_at,
                    user_agent,
                    ip_address
                )
                values ($1, $2, $3, $4, nullif($5, '')::inet)
            `,
            [
                input.userId,
                input.sessionTokenHash,
                input.expiresAt,
                input.userAgent ?? null,
                input.ipAddress ?? null,
            ],
        );
    }

    async revokeSession(sessionTokenHash: string): Promise<string | null> {
        const result = await this.client.query(
            `
                update public.app_sessions
                set revoked_at = now()
                where session_token_hash = $1
                  and revoked_at is null
                returning user_id
            `,
            [sessionTokenHash],
        );
        return readOptionalString(result.rows[0]?.user_id) ?? null;
    }

    async recordPasswordFailure(userId: string): Promise<void> {
        await this.client.query(
            `
                update public.app_user_credentials
                set
                    failed_login_count = failed_login_count + 1,
                    locked_until = case
                        when failed_login_count + 1 >= $2
                            then now() + ($3::text || ' minutes')::interval
                        else locked_until
                    end
                where user_id = $1
            `,
            [userId, FAILED_LOGIN_LIMIT, LOGIN_LOCK_MINUTES],
        );
    }

    async clearPasswordFailures(userId: string): Promise<void> {
        await this.client.query(
            `
                update public.app_user_credentials
                set failed_login_count = 0, locked_until = null
                where user_id = $1
                  and (failed_login_count <> 0 or locked_until is not null)
            `,
            [userId],
        );
    }

    async recordAuditEvent(event: AuthAuditEvent): Promise<void> {
        await this.client.query(
            `
                insert into public.auth_audit_events (
                    user_id,
                    event_type,
                    outcome,
                    ip_address,
                    user_agent,
                    metadata
                )
                values ($1, $2, $3, nullif($4, '')::inet, $5, $6::jsonb)
            `,
            [
                event.userId ?? null,
                event.eventType,
                event.outcome,
                event.ipAddress ?? null,
                event.userAgent ?? null,
                JSON.stringify(event.metadata ?? {}),
            ],
        );
    }
}

function mapUser(row: Record<string, unknown>): AppUser {
    return {
        id: requireString(row.user_id, "user_id"),
        email: requireString(row.email, "email"),
        displayName: readOptionalString(row.display_name),
        firstName: readOptionalString(row.first_name),
        lastName: readOptionalString(row.last_name),
        status: readStatus(row.status),
        roles: normalizeAppRoles(row.roles),
    };
}

function readStatus(value: unknown): AppUserStatus {
    if (value === "active" || value === "invited" || value === "disabled") return value;
    throw new Error("App auth query returned an unsupported user status.");
}

function requireString(value: unknown, field: string): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`App auth query returned an invalid ${field}.`);
    }
    return value;
}

function readOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number : 0;
}

function toIsoString(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.valueOf())) {
        throw new Error("App auth query returned an invalid locked_until value.");
    }
    return date.toISOString();
}
