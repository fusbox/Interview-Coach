import { cookies } from "next/headers";

import { getUserBySessionToken } from "../recruiter-auth-v2/app-auth";
import { getAppSessionCookieName } from "../recruiter-auth-v2/app-session";
import type { AppUser } from "../recruiter-auth-v2/app-user";

export type AiEvalOperatorGrant = {
    grantId: string;
    userId: string;
    grantedAt: string;
};

export type AiEvalOperatorAccess =
    | { kind: "authorized"; user: AppUser; grant: AiEvalOperatorGrant }
    | { kind: "missing" }
    | { kind: "forbidden"; user: AppUser };

export type AiEvalOperatorQueryClient = {
    query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

type CookieReader = {
    get(name: string): { value: string } | undefined;
};

export function createAiEvalOperatorAccessRepository(client: AiEvalOperatorQueryClient) {
    return {
        async findActiveGrant(userId: string): Promise<AiEvalOperatorGrant | null> {
            const result = await client.query(`
                select
                  operator_grant.ai_eval_operator_grant_id,
                  operator_grant.user_id,
                  to_char(
                    operator_grant.granted_at at time zone 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                  ) as granted_at
                from public.ai_eval_operator_grants operator_grant
                join public.app_users app_user
                  on app_user.user_id = operator_grant.user_id
                 and app_user.status = 'active'
                where operator_grant.user_id = $1
                  and operator_grant.lifecycle_state = 'active'
                limit 1
            `, [userId]);

            return mapGrant(result.rows[0]);
        },
    };
}

export async function getCurrentAiEvalOperatorAccess(dependencies: {
    cookieStore?: CookieReader;
    resolveUser?: (sessionToken: string | undefined) => Promise<AppUser | null>;
    resolveGrant: (userId: string) => Promise<AiEvalOperatorGrant | null>;
}): Promise<AiEvalOperatorAccess> {
    const cookieStore = dependencies.cookieStore ?? await cookies();
    const sessionToken = cookieStore.get(getAppSessionCookieName())?.value;
    const user = await (dependencies.resolveUser ?? getUserBySessionToken)(sessionToken);

    if (!user) return { kind: "missing" };

    const grant = await dependencies.resolveGrant(user.id);
    if (!grant) return { kind: "forbidden", user };
    return { kind: "authorized", user, grant };
}

function mapGrant(row: Record<string, unknown> | undefined): AiEvalOperatorGrant | null {
    if (!row) return null;
    const grantId = readString(row.ai_eval_operator_grant_id);
    const userId = readString(row.user_id);
    const grantedAt = readString(row.granted_at);
    if (!grantId || !userId || !grantedAt) return null;
    return { grantId, userId, grantedAt };
}

function readString(value: unknown) {
    return typeof value === "string" ? value : "";
}
