export function resolveCandidateAccountOrigin(
    requestUrl: string,
    env: Readonly<Record<string, string | undefined>> = process.env,
): string {
    const configured = env.CANDIDATE_ACCOUNT_PUBLIC_ORIGIN?.trim();
    const candidate = configured || new URL(requestUrl).origin;
    const url = new URL(candidate);
    if (
        (url.protocol !== "http:" && url.protocol !== "https:")
        || url.username
        || url.password
        || url.pathname !== "/"
        || url.search
        || url.hash
    ) {
        throw new Error("Candidate account public origin is invalid.");
    }
    if (url.hostname === "0.0.0.0" || url.hostname === "::" || url.hostname === "[::]") {
        if (env.NODE_ENV === "production" || configured) {
            throw new Error("Candidate account public origin must be browser-addressable.");
        }
        url.hostname = "localhost";
    }
    if (env.NODE_ENV === "production" && !configured) {
        throw new Error("CANDIDATE_ACCOUNT_PUBLIC_ORIGIN is required in production.");
    }
    return url.origin;
}
