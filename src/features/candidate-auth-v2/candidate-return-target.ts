const DEFAULT_CANDIDATE_RETURN_TARGET = "/candidate";

export function resolveCandidateReturnTarget(value: string | undefined): string {
    if (!value) return DEFAULT_CANDIDATE_RETURN_TARGET;
    if (
        (value !== "/candidate" && !value.startsWith("/candidate/"))
        || value.startsWith("//")
    ) {
        return DEFAULT_CANDIDATE_RETURN_TARGET;
    }
    try {
        const url = new URL(value, "https://interviewcoach.invalid");
        if (url.origin !== "https://interviewcoach.invalid") {
            return DEFAULT_CANDIDATE_RETURN_TARGET;
        }
        if (
            url.pathname.startsWith("/candidate/login")
            || url.pathname.startsWith("/candidate/register")
            || url.pathname.startsWith("/candidate/verify-email")
            || url.pathname.startsWith("/candidate/account/")
            || url.pathname.startsWith("/candidate/launch")
            || url.pathname.startsWith("/candidate/dev/")
            || url.pathname.startsWith("/candidate/invited")
        ) {
            return DEFAULT_CANDIDATE_RETURN_TARGET;
        }
        return `${url.pathname}${url.search}`;
    } catch {
        return DEFAULT_CANDIDATE_RETURN_TARGET;
    }
}
