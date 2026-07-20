export function isTrustedSameOriginMutationRequest(request: Request) {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin") return false;

    const origin = request.headers.get("origin");
    if (!origin) return false;

    try {
        const requestUrl = new URL(request.url);
        const allowedOrigins = new Set([requestUrl.origin]);
        addPublicOrigin(allowedOrigins, requestUrl.protocol, request.headers.get("host"));
        addPublicOrigin(
            allowedOrigins,
            firstForwardedValue(request.headers.get("x-forwarded-proto")) ?? requestUrl.protocol,
            request.headers.get("x-forwarded-host"),
        );
        return allowedOrigins.has(new URL(origin).origin);
    } catch {
        return false;
    }
}

function addPublicOrigin(origins: Set<string>, protocol: string, hostHeader: string | null) {
    const host = firstForwardedValue(hostHeader);
    const normalizedProtocol = firstForwardedValue(protocol)?.replace(/:$/, "");
    if (!host || (normalizedProtocol !== "http" && normalizedProtocol !== "https")) return;
    origins.add(new URL(`${normalizedProtocol}://${host}`).origin);
}

function firstForwardedValue(value: string | null) {
    return value?.split(",", 1)[0]?.trim() || null;
}
