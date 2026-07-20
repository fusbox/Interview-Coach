import { NextRequest, NextResponse } from "next/server";

import { getAppUserDisplayName } from "@/features/recruiter-auth-v2/app-user";
import { getCurrentRecruiterAccess, type RecruiterAccess } from "@/features/recruiter-auth-v2/current-recruiter-access";
import { createRecruiterAuthQueryClientFromEnv } from "@/features/recruiter-auth-v2/recruiter-auth-postgres-runtime";
import {
    parseRecruiterInvitationDeliveryRequest,
    RecruiterInvitationDeliveryValidationError,
    type RecruiterInvitationDeliveryRequest,
} from "@/features/recruiter-invites-v2/recruiter-invitation-delivery-contract";
import { createRecruiterInvitationDeliveryProvider } from "@/features/recruiter-invites-v2/recruiter-invitation-delivery-provider";
import { createRecruiterInvitationDeliveryRepository } from "@/features/recruiter-invites-v2/recruiter-invitation-delivery-repository";
import {
    deliverRecruiterInvitationBatch,
    RecruiterInvitationDeliveryNotFoundError,
    type RecruiterInvitationDeliveryResult,
} from "@/features/recruiter-invites-v2/recruiter-invitation-delivery-service";
import { createRecruiterInvitationRepository } from "@/features/recruiter-invites-v2/recruiter-invitation-repository";
import { createInvitedPracticeTokenVault } from "@/features/recruiter-invites-v2/invited-practice-token-vault";
import { resolveRecruiterInvitationAppOrigin } from "@/features/recruiter-invites-v2/recruiter-invitation-app-origin";

const MAX_DELIVERY_REQUEST_BYTES = 16_384;

type DeliverInvitations = (
    access: Extract<RecruiterAccess, { kind: "authorized" }>,
    request: RecruiterInvitationDeliveryRequest,
    appOrigin: string,
) => Promise<RecruiterInvitationDeliveryResult>;

export function createRecruiterInvitationDeliveryRouteHandler(dependencies: {
    resolveAccess?: () => Promise<RecruiterAccess>;
    deliverInvitations?: DeliverInvitations;
    resolveAppOrigin?: (request: NextRequest) => string;
} = {}) {
    return async function recruiterInvitationDeliveryRoute(request: NextRequest) {
        const declaredLength = Number(request.headers.get("content-length"));
        if (Number.isFinite(declaredLength) && declaredLength > MAX_DELIVERY_REQUEST_BYTES) {
            return jsonError(413, "REQUEST_TOO_LARGE", "The delivery request is too large.");
        }
        const access = await (dependencies.resolveAccess ?? getCurrentRecruiterAccess)();
        if (access.kind === "missing") return jsonError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
        if (access.kind === "forbidden") return jsonError(403, "RECRUITER_ACCESS_REQUIRED", "Recruiter access is required.");
        if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
            return jsonError(415, "JSON_REQUIRED", "This endpoint accepts JSON requests only.");
        }

        let parsed: RecruiterInvitationDeliveryRequest;
        try {
            const rawBody = await request.text();
            if (new TextEncoder().encode(rawBody).byteLength > MAX_DELIVERY_REQUEST_BYTES) {
                return jsonError(413, "REQUEST_TOO_LARGE", "The delivery request is too large.");
            }
            parsed = parseRecruiterInvitationDeliveryRequest(JSON.parse(rawBody));
        } catch (error) {
            if (error instanceof RecruiterInvitationDeliveryValidationError || error instanceof SyntaxError) {
                return jsonError(400, "INVALID_REQUEST", "Review the delivery request and try again.");
            }
            return jsonError(400, "INVALID_REQUEST", "Review the delivery request and try again.");
        }

        try {
            const appOrigin = (dependencies.resolveAppOrigin ?? defaultResolveAppOrigin)(request);
            const result = await (dependencies.deliverInvitations ?? defaultDeliverInvitations)(access, parsed, appOrigin);
            const acceptedCount = result.recipients.filter((recipient) => recipient.status === "provider_accepted").length;
            const retryableFailureCount = result.recipients.filter((recipient) => recipient.status === "failed" && recipient.retryable).length;
            const blockedCount = result.recipients.length - acceptedCount - retryableFailureCount;
            return noStoreJson({
                status: "delivery_processed",
                batchId: result.batchId,
                summary: { acceptedCount, retryableFailureCount, blockedCount },
                recipients: result.recipients,
            });
        } catch (error) {
            if (error instanceof RecruiterInvitationDeliveryNotFoundError) {
                return jsonError(404, "INVITATION_BATCH_NOT_FOUND", "Invitation batch not found.");
            }
            return jsonError(503, "INVITATION_DELIVERY_UNAVAILABLE", "Invitation delivery is temporarily unavailable.", true);
        }
    };
}

async function defaultDeliverInvitations(
    access: Extract<RecruiterAccess, { kind: "authorized" }>,
    request: RecruiterInvitationDeliveryRequest,
    appOrigin: string,
) {
    const client = createRecruiterAuthQueryClientFromEnv();
    return deliverRecruiterInvitationBatch({
        recruiterId: access.user.id,
        recruiterName: getAppUserDisplayName(access.user),
        batchId: request.batchId,
        actionKey: request.actionKey,
        appOrigin,
    }, {
        invitationRepository: createRecruiterInvitationRepository(client),
        deliveryRepository: createRecruiterInvitationDeliveryRepository(client),
        provider: createRecruiterInvitationDeliveryProvider(),
        tokenVault: createInvitedPracticeTokenVault(),
    });
}

function defaultResolveAppOrigin(request: NextRequest) {
    return resolveRecruiterInvitationAppOrigin(request.url);
}

function jsonError(status: number, code: string, message: string, retryable = false) {
    return NextResponse.json({ code, message, retryable }, {
        status,
        headers: { "Cache-Control": "private, no-store" },
    });
}

function noStoreJson(body: Record<string, unknown>) {
    return NextResponse.json(body, {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
    });
}
