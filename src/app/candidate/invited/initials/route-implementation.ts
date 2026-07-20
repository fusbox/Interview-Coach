import { InvalidInvitedPracticeInitialsError } from "@/features/recruiter-invites-v2/invited-practice-entry-service";
import { isTrustedSameOriginMutationRequest } from "@/lib/server/trusted-mutation-request";

const MAX_BODY_BYTES = 1_024;

export async function handleInvitedPracticeInitialsRequest(input: {
    request: Request;
    rawBrowserSessionToken: string | undefined;
    confirm: (input: { rawBrowserSessionToken: string | undefined; initials: unknown }) => Promise<{
        initialsConfirmed: true;
        matchState: "match" | "mismatch";
        candidateFirstName?: string;
    } | null>;
}) {
    const headers = { "Cache-Control": "private, no-store, max-age=0" };
    if (!isTrustedSameOriginMutationRequest(input.request)) {
        return Response.json({ error: "INVITED_ACCESS_REQUIRED" }, { status: 403, headers });
    }
    if (!input.request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
        return Response.json({ error: "JSON_REQUIRED" }, { status: 415, headers });
    }
    const declaredLength = Number(input.request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
        return Response.json({ error: "REQUEST_TOO_LARGE" }, { status: 413, headers });
    }

    try {
        const text = await input.request.text();
        if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
            return Response.json({ error: "REQUEST_TOO_LARGE" }, { status: 413, headers });
        }
        const body = JSON.parse(text) as unknown;
        if (!isStrictInitialsBody(body)) {
            return Response.json({ error: "INVALID_INITIALS" }, { status: 400, headers });
        }
        const result = await input.confirm({
            rawBrowserSessionToken: input.rawBrowserSessionToken,
            initials: body.initials,
        });
        if (!result) {
            return Response.json({ error: "INVITED_ACCESS_REQUIRED" }, { status: 401, headers });
        }
        return Response.json({
            initialsConfirmed: true,
            ...(result.candidateFirstName ? { candidateFirstName: result.candidateFirstName } : {}),
        }, { status: 200, headers });
    } catch (error) {
        if (error instanceof SyntaxError || error instanceof InvalidInvitedPracticeInitialsError) {
            return Response.json({ error: "INVALID_INITIALS" }, { status: 400, headers });
        }
        return Response.json({ error: "INITIALS_SAVE_UNAVAILABLE" }, { status: 503, headers });
    }
}

function isStrictInitialsBody(value: unknown): value is { initials: unknown } {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    return keys.length === 1 && keys[0] === "initials";
}
