type AppOriginEnv = Readonly<Record<string, string | undefined>>;

export function resolveRecruiterInvitationAppOrigin(
    requestUrl: string,
    env: AppOriginEnv = process.env,
) {
    const configured = env.NEXT_PUBLIC_APP_URL?.trim();
    const production = env.NODE_ENV === "production";
    if (!configured && production) {
        throw new Error("NEXT_PUBLIC_APP_URL is required for recruiter invitations in production.");
    }

    // Local invitations should stay on the host and port the recruiter is
    // actively using. Production remains pinned to the configured public URL.
    const url = new URL(production ? configured! : requestUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Invitation app origin must use HTTP or HTTPS.");
    }
    if (production && url.protocol !== "https:") {
        throw new Error("Invitation app origin must use HTTPS in production.");
    }

    return url.origin;
}

export function resolveRecruiterInvitationAppOriginFromRequest(
    request: Pick<Request, "url" | "headers">,
    env: AppOriginEnv = process.env,
) {
    if (env.NODE_ENV === "production") {
        return resolveRecruiterInvitationAppOrigin(request.url, env);
    }

    const requestUrl = new URL(request.url);
    const host = firstForwardedValue(
        request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    );
    if (!host) return resolveRecruiterInvitationAppOrigin(request.url, env);

    const protocol = firstForwardedValue(request.headers.get("x-forwarded-proto"))
        ?? requestUrl.protocol.replace(/:$/, "");
    return resolveRecruiterInvitationAppOrigin(`${protocol}://${host}`, env);
}

function firstForwardedValue(value: string | null) {
    return value?.split(",", 1)[0]?.trim() || null;
}
