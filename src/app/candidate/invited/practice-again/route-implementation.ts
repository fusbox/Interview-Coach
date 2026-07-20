import {
    serializeInvitedPracticeAccessCookie,
} from "@/features/recruiter-invites-v2/invited-practice-access-session";
import { isTrustedSameOriginMutationRequest } from "@/lib/server/trusted-mutation-request";

type RepeatResult =
    | null
    | { outcome: "invalid_state" | "stale_parent" }
    | {
        outcome: "created" | "replayed";
        sessionId: string;
        rawBrowserSessionToken: string;
        expiresAt: string;
    };

export async function handleInvitedPracticeAgainRequest(input: {
    request: Request;
    secureCookie: boolean;
    repeat: (expectedParentSessionId: string) => Promise<RepeatResult>;
}) {
    if (!isTrustedSameOriginMutationRequest(input.request)) {
        return Response.json({ error: "Invited practice access is required." }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await input.request.json();
    } catch {
        return Response.json({ error: "A completed practice round is required." }, { status: 400 });
    }
    const expectedParentSessionId = readExpectedParentSessionId(body);
    if (!expectedParentSessionId) {
        return Response.json({ error: "A completed practice round is required." }, { status: 400 });
    }

    const result = await input.repeat(expectedParentSessionId);
    if (!result) {
        return Response.json({ error: "Invited practice access is required." }, { status: 401 });
    }
    if (result.outcome === "invalid_state" || result.outcome === "stale_parent") {
        return Response.json({
            error: "This practice round has already moved forward. Reopen the invitation to continue.",
        }, { status: 409 });
    }

    if (!("rawBrowserSessionToken" in result)) {
        return Response.json({ error: "Invited practice access is required." }, { status: 401 });
    }

    return Response.json({
        status: "invited_practice_attempt_ready",
        outcome: result.outcome,
        nextRoute: "/candidate/invited",
    }, {
        headers: {
            "Cache-Control": "no-store",
            "Set-Cookie": serializeInvitedPracticeAccessCookie({
                rawSessionToken: result.rawBrowserSessionToken,
                expiresAt: result.expiresAt,
                secure: input.secureCookie,
            }),
        },
    });
}

function readExpectedParentSessionId(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const sessionId = (value as Record<string, unknown>).sessionId;
    return typeof sessionId === "string" && sessionId.trim() ? sessionId : null;
}
