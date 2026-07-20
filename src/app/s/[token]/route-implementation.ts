import { randomUUID } from "node:crypto";

import {
    clearInvitedPracticeAccessCookie,
    INVITED_PRACTICE_CLEAN_ENTRY_PATH,
    INVITED_PRACTICE_UNAVAILABLE_PATH,
    serializeInvitedPracticeAccessCookie,
} from "@/features/recruiter-invites-v2/invited-practice-access-session";

export type InvitedPracticeExchangeDiagnostic = {
    requestId: string;
    outcome: "accepted" | "rejected" | "unavailable";
};

export async function handleInvitedPracticeLinkExchange(input: {
    rawInvitationToken: string;
    secureCookie: boolean;
    exchange: (rawInvitationToken: string) => Promise<{
        rawBrowserSessionToken: string;
        expiresAt: string;
    } | null>;
    requestId?: string;
    onDiagnostic?: (event: InvitedPracticeExchangeDiagnostic) => void;
}) {
    const requestId = input.requestId ?? randomUUID();
    const responseHeaders = new Headers({
        "Cache-Control": "private, no-store, max-age=0",
        "Pragma": "no-cache",
        "Referrer-Policy": "no-referrer",
        "X-Interview-Coach-Request-Id": requestId,
        "X-Robots-Tag": "noindex, nofollow",
    });

    try {
        const exchange = await input.exchange(input.rawInvitationToken);
        if (!exchange) {
            emitDiagnostic(input.onDiagnostic, { requestId, outcome: "rejected" });
            responseHeaders.set("Location", INVITED_PRACTICE_UNAVAILABLE_PATH);
            responseHeaders.append("Set-Cookie", clearInvitedPracticeAccessCookie(input.secureCookie));
            return new Response(null, { status: 302, headers: responseHeaders });
        }

        responseHeaders.set("Location", INVITED_PRACTICE_CLEAN_ENTRY_PATH);
        responseHeaders.append("Set-Cookie", serializeInvitedPracticeAccessCookie({
            rawSessionToken: exchange.rawBrowserSessionToken,
            expiresAt: exchange.expiresAt,
            secure: input.secureCookie,
        }));
        emitDiagnostic(input.onDiagnostic, { requestId, outcome: "accepted" });
        return new Response(null, { status: 302, headers: responseHeaders });
    } catch {
        emitDiagnostic(input.onDiagnostic, { requestId, outcome: "unavailable" });
        responseHeaders.set("Location", INVITED_PRACTICE_UNAVAILABLE_PATH);
        responseHeaders.append("Set-Cookie", clearInvitedPracticeAccessCookie(input.secureCookie));
        return new Response(null, { status: 302, headers: responseHeaders });
    }
}

function emitDiagnostic(
    sink: ((event: InvitedPracticeExchangeDiagnostic) => void) | undefined,
    event: InvitedPracticeExchangeDiagnostic,
) {
    try {
        sink?.(event);
    } catch {
        // Access correctness cannot depend on telemetry delivery.
    }
}
