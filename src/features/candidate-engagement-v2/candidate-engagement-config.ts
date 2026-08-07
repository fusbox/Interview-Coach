export const CANDIDATE_ENGAGEMENT_REPORTING_ENABLED_ENV = "CANDIDATE_ENGAGEMENT_REPORTING_ENABLED";

type EngagementEnvironment = Readonly<Record<string, string | undefined>>;

export function isCandidateEngagementReportingEnabled(
    env: EngagementEnvironment = process.env,
): boolean {
    const configured = env[CANDIDATE_ENGAGEMENT_REPORTING_ENABLED_ENV]?.trim().toLowerCase();
    if (configured === "true") return true;
    if (configured === "false") return false;
    return env.NODE_ENV !== "production";
}

export function isCandidateEngagementInspectorEnabled(
    env: EngagementEnvironment = process.env,
): boolean {
    return env.NODE_ENV !== "production";
}
