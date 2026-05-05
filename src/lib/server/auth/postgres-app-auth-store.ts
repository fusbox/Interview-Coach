import type { Pool, QueryResultRow } from "pg";
import type { AppUser } from "@/lib/auth/user";
import { getPostgresPool } from "@/lib/server/db/postgres";
import {
    type AppAuthStore,
    type AuthAuditEvent,
    type CreateAppSessionParams,
    type PasswordCredentialRecord,
    normalizeAuthEmail,
    normalizeRoles,
} from "./app-auth-store";

type CredentialRow = QueryResultRow & {
    user_id: string;
    email: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    status: AppUser["status"];
    password_hash: string;
    failed_login_count: number;
    locked_until: string | Date | null;
    roles: unknown;
};

type UserSessionRow = QueryResultRow & {
    user_id: string;
    email: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    status: AppUser["status"];
    roles: unknown;
};

export class PostgresAppAuthStore implements AppAuthStore {
    constructor(private readonly pool: Pool = getPostgresPool()) {}

    async findPasswordCredentialByEmail(email: string): Promise<PasswordCredentialRecord | null> {
        const result = await this.pool.query<CredentialRow>(
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
            [normalizeAuthEmail(email)]
        );
        const row = result.rows[0];
        if (!row) {
            return null;
        }

        return {
            user: mapUser(row),
            passwordHash: row.password_hash,
            failedLoginCount: Number(row.failed_login_count ?? 0),
            lockedUntil: toIsoString(row.locked_until),
        };
    }

    async findUserBySessionTokenHash(sessionTokenHash: string): Promise<AppUser | null> {
        const result = await this.pool.query<UserSessionRow>(
            `
                select
                    u.user_id,
                    u.email,
                    u.display_name,
                    u.first_name,
                    u.last_name,
                    u.status,
                    coalesce(array_agg(r.role) filter (where r.role is not null), '{}') as roles
                from public.app_sessions s
                join public.app_users u on u.user_id = s.user_id
                left join public.app_user_roles r on r.user_id = u.user_id
                where s.session_token_hash = $1
                  and s.revoked_at is null
                  and s.expires_at > now()
                  and u.status = 'active'
                group by
                    s.session_id,
                    u.user_id,
                    u.email,
                    u.display_name,
                    u.first_name,
                    u.last_name,
                    u.status,
                    s.created_at
                limit 1
            `,
            [sessionTokenHash]
        );

        if (!result.rows[0]) {
            return null;
        }

        await this.pool.query(
            `
                update public.app_sessions
                set last_seen_at = now()
                where session_token_hash = $1
                  and revoked_at is null
            `,
            [sessionTokenHash]
        );

        return mapUser(result.rows[0]);
    }

    async createSession(params: CreateAppSessionParams): Promise<void> {
        await this.pool.query(
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
                params.userId,
                params.sessionTokenHash,
                params.expiresAt,
                params.userAgent ?? null,
                params.ipAddress ?? null,
            ]
        );
    }

    async revokeSession(sessionTokenHash: string): Promise<void> {
        await this.pool.query(
            `
                update public.app_sessions
                set revoked_at = now()
                where session_token_hash = $1
                  and revoked_at is null
            `,
            [sessionTokenHash]
        );
    }

    async recordAuditEvent(event: AuthAuditEvent): Promise<void> {
        await this.pool.query(
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
            ]
        );
    }
}

function mapUser(row: CredentialRow | UserSessionRow): AppUser {
    return {
        id: row.user_id,
        email: row.email,
        displayName: row.display_name ?? undefined,
        firstName: row.first_name ?? undefined,
        lastName: row.last_name ?? undefined,
        status: row.status,
        roles: normalizeRoles(row.roles),
        app_metadata: { roles: normalizeRoles(row.roles) },
        user_metadata: {},
    };
}

function toIsoString(value: string | Date | null): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return new Date(value).toISOString();
}
