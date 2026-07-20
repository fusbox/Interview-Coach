import { NextResponse } from "next/server";

import type { RecruiterAccess } from "@/features/recruiter-auth-v2/current-recruiter-access";
import {
    parseRecruiterSettingsUpdate,
    RecruiterSettingsValidationError,
    type RecruiterSettings,
} from "@/features/recruiter-auth-v2/recruiter-settings-contract";
import type { RecruiterSettingsUpdateOutcome } from "@/features/recruiter-auth-v2/recruiter-settings-repository";
import { isTrustedSameOriginMutationRequest } from "@/lib/server/trusted-mutation-request";

const MAX_REQUEST_BYTES = 4_096;

export async function handleRecruiterProfileUpdate(input: {
    request: Request;
    access: RecruiterAccess;
    update: (input: {
        userId: string;
        senderDisplayName: string;
        revision: string;
    }) => Promise<RecruiterSettingsUpdateOutcome>;
}) {
    if (!isTrustedSameOriginMutationRequest(input.request)) {
        return jsonError(403, "TRUSTED_ORIGIN_REQUIRED", "Recruiter access is required.");
    }
    if (input.access.kind === "missing") {
        return jsonError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
    }
    if (input.access.kind === "forbidden") {
        return jsonError(403, "RECRUITER_ACCESS_REQUIRED", "Recruiter access is required.");
    }
    if (!input.request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
        return jsonError(415, "JSON_REQUIRED", "This endpoint accepts JSON requests only.");
    }
    const declaredLength = Number(input.request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
        return jsonError(413, "REQUEST_TOO_LARGE", "The settings request is too large.");
    }

    try {
        const text = await input.request.text();
        if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
            return jsonError(413, "REQUEST_TOO_LARGE", "The settings request is too large.");
        }
        const parsed = parseRecruiterSettingsUpdate(JSON.parse(text));
        const result = await input.update({
            userId: input.access.user.id,
            ...parsed,
        });
        if (result.outcome === "not_found") {
            return jsonError(403, "RECRUITER_ACCESS_REQUIRED", "Recruiter access is required.");
        }
        if (result.outcome === "conflict") {
            return jsonError(
                409,
                "SETTINGS_CHANGED",
                "These settings changed in another tab. Refresh before saving again.",
            );
        }
        return noStoreJson({
            status: "settings_saved",
            outcome: result.outcome,
            settings: result.settings,
        });
    } catch (error) {
        if (error instanceof SyntaxError || error instanceof RecruiterSettingsValidationError) {
            return jsonError(400, "INVALID_SETTINGS", "Review the name shown to candidates and try again.");
        }
        return jsonError(503, "SETTINGS_SAVE_UNAVAILABLE", "Settings could not be saved. Try again.");
    }
}

function jsonError(status: number, code: string, message: string) {
    return NextResponse.json({ code, message }, {
        status,
        headers: { "Cache-Control": "private, no-store" },
    });
}

function noStoreJson(body: {
    status: string;
    outcome: "updated" | "unchanged";
    settings: RecruiterSettings;
}) {
    return NextResponse.json(body, {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
    });
}
