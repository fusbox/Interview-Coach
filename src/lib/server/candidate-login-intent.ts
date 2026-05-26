export const talentArborCandidateLoginUrl = "https://talentarbor.com/Auth/LoginWithType/2";
export const candidateLoginNextCookieName = "ic_candidate_login_next";
export const defaultCandidateLoginNext = "/dashboard";

const candidateLoginNextPathPatterns = [
    /^\/practice$/,
    /^\/dashboard$/,
    /^\/session\/[A-Za-z0-9_-]+$/,
    /^\/summary(?:\/[A-Za-z0-9_-]+)?$/,
];

export function resolveCandidateLoginNext(rawNext: string | null | undefined) {
    if (!rawNext) {
        return defaultCandidateLoginNext;
    }

    let candidatePath: string;

    try {
        candidatePath = decodeURIComponent(rawNext);
    } catch {
        return defaultCandidateLoginNext;
    }

    if (
        !candidatePath.startsWith("/") ||
        candidatePath.startsWith("//") ||
        candidatePath.includes("\\") ||
        candidatePath.includes("?") ||
        candidatePath.includes("#")
    ) {
        return defaultCandidateLoginNext;
    }

    return candidateLoginNextPathPatterns.some((pattern) => pattern.test(candidatePath))
        ? candidatePath
        : defaultCandidateLoginNext;
}

export function isFallbackCandidateLoginNext(rawNext: string | null | undefined) {
    return resolveCandidateLoginNext(rawNext) !== rawNext;
}
