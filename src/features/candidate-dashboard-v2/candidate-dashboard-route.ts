export const CANDIDATE_DASHBOARD_ROUTE = "/candidate/dashboard";

export type CandidateDashboardRouteContext =
    | {
        roleProfileId: string;
        legacyTargetRole?: never;
    }
    | {
        roleProfileId?: null;
        legacyTargetRole: string;
    };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeCandidateTargetInterviewId(value: string | null | undefined) {
    return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeCandidateRoleProfileId(value: string | null | undefined) {
    const normalized = (value ?? "").trim().toLowerCase();
    return uuidPattern.test(normalized) ? normalized : null;
}

export function createCandidateDashboardHref(context?: CandidateDashboardRouteContext | null) {
    const roleProfileId = normalizeCandidateRoleProfileId(context?.roleProfileId);
    if (roleProfileId) {
        const searchParams = new URLSearchParams({ prep: roleProfileId });
        return `${CANDIDATE_DASHBOARD_ROUTE}?${searchParams.toString()}`;
    }

    const legacyTargetRole = normalizeCandidateTargetInterviewId(context?.legacyTargetRole);
    if (!legacyTargetRole) {
        return CANDIDATE_DASHBOARD_ROUTE;
    }

    const searchParams = new URLSearchParams({
        targetRole: legacyTargetRole,
    });
    return `${CANDIDATE_DASHBOARD_ROUTE}?${searchParams.toString()}`;
}
