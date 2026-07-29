import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createCandidatePostgresQueryClient, type CandidatePostgresQueryClient } from "./candidate-postgres-runtime";
import { resolveCandidateReturnTarget } from "./candidate-return-target";
import { resolveCandidateRouteAccess, type CandidateRouteAccess } from "./candidate-route-access";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "./production-host-launch-runtime";

export type CandidateOwnedRouteIdentity = {
    candidateProfileId: string;
    accessSource: CandidateRouteAccess["source"];
};

export async function resolveCandidateOwnedCookieIdentity(
    cookieHeader: string | null,
    client: CandidatePostgresQueryClient,
): Promise<CandidateOwnedRouteIdentity | null> {
    const access = await resolveCandidateRouteAccess(cookieHeader, client);
    return access
        ? {
            candidateProfileId: access.candidateProfileId,
            accessSource: access.source,
        }
        : null;
}

export function resolveCandidateOwnedRequestIdentity(
    request: Request,
    client: CandidatePostgresQueryClient,
) {
    return resolveCandidateOwnedCookieIdentity(request.headers.get("cookie"), client);
}

export function createCandidateLoginHref(returnTarget: string) {
    const safeTarget = resolveCandidateReturnTarget(returnTarget);
    return `/candidate/login?next=${encodeURIComponent(safeTarget)}`;
}

export function createCandidateReturnPath(
    pathname: string,
    searchParams: Record<string, string | string[] | undefined>,
) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
        if (Array.isArray(value)) {
            value.forEach((item) => query.append(key, item));
        } else if (value !== undefined) {
            query.set(key, value);
        }
    }
    const serializedQuery = query.toString();
    return serializedQuery ? `${pathname}?${serializedQuery}` : pathname;
}

export async function resolveCandidateEntryDestination(
    identity: CandidateOwnedRouteIdentity,
    client: CandidatePostgresQueryClient,
): Promise<"/candidate/setup" | "/candidate/dashboard"> {
    const result = await client.query(`
        select role_profile_id
        from public.candidate_role_preparation_profiles
        where candidate_profile_id = $1
          and status <> 'archived'
        limit 1
    `, [identity.candidateProfileId]);

    return result.rows.length > 0
        ? "/candidate/dashboard"
        : "/candidate/setup";
}

export async function requireCurrentCandidatePageAccess(
    returnTarget: string,
): Promise<{
    access: CandidateRouteAccess;
    identity: CandidateOwnedRouteIdentity;
    client: CandidatePostgresQueryClient;
}> {
    const requestHeaders = await headers();
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    const client = databaseUrl
        ? createCandidatePostgresQueryClient(databaseUrl)
        : createUnavailableCandidateQueryClient();
    const access = await resolveCandidateRouteAccess(
        requestHeaders.get("cookie"),
        client,
    );

    if (!access) {
        redirect(createCandidateLoginHref(returnTarget));
    }

    return {
        access,
        identity: {
            candidateProfileId: access.candidateProfileId,
            accessSource: access.source,
        },
        client,
    };
}

function createUnavailableCandidateQueryClient(): CandidatePostgresQueryClient {
    return {
        async query() {
            throw new Error("Candidate database access is not configured.");
        },
    };
}
