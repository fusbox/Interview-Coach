export const CANDIDATE_DASHBOARD_ROUTE = "/candidate/dashboard";

export function normalizeCandidateTargetInterviewId(value: string | null | undefined) {
    return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function createCandidateDashboardHref(targetInterviewId?: string | null) {
    const normalizedTargetInterviewId = normalizeCandidateTargetInterviewId(targetInterviewId);
    if (!normalizedTargetInterviewId) {
        return CANDIDATE_DASHBOARD_ROUTE;
    }

    const searchParams = new URLSearchParams({
        targetRole: normalizedTargetInterviewId,
    });
    return `${CANDIDATE_DASHBOARD_ROUTE}?${searchParams.toString()}`;
}
