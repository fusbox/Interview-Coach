const DEFAULT_RECRUITER_RETURN_TARGET = "/recruiter";

export function resolveRecruiterReturnTarget(value: unknown): string {
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
        return DEFAULT_RECRUITER_RETURN_TARGET;
    }

    try {
        const url = new URL(value, "https://interview-coach.invalid");
        if (url.origin !== "https://interview-coach.invalid") return DEFAULT_RECRUITER_RETURN_TARGET;
        if (url.pathname !== "/recruiter" && !url.pathname.startsWith("/recruiter/")) {
            return DEFAULT_RECRUITER_RETURN_TARGET;
        }
        return `${url.pathname}${url.search}`;
    } catch {
        return DEFAULT_RECRUITER_RETURN_TARGET;
    }
}
