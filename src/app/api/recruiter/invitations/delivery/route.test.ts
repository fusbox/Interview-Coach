import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { createRecruiterInvitationDeliveryRouteHandler } from "./route-implementation";

describe("recruiter invitation delivery API", () => {
    it("requires recruiter authentication before reading delivery input", async () => {
        const deliverInvitations = vi.fn();
        const response = await createRecruiterInvitationDeliveryRouteHandler({
            resolveAccess: vi.fn().mockResolvedValue({ kind: "missing" }),
            deliverInvitations,
        })(request(body()));

        expect(response.status).toBe(401);
        expect(deliverInvitations).not.toHaveBeenCalled();
    });

    it("derives recruiter identity from the app session and reports provider acceptance truthfully", async () => {
        const deliverInvitations = vi.fn().mockResolvedValue({
            batchId: BATCH_ID,
            recipients: [
                { recipientId: "recipient-1", attemptId: "attempt-1", attemptNumber: 1, status: "provider_accepted", retryable: false, failureCode: null },
                { recipientId: "recipient-2", attemptId: "attempt-2", attemptNumber: 1, status: "failed", retryable: true, failureCode: "provider_not_configured" },
            ],
        });
        const response = await createRecruiterInvitationDeliveryRouteHandler({
            resolveAccess: authorizedAccess,
            deliverInvitations,
            resolveAppOrigin: () => "https://interviewcoach.example",
        })(request(body()));
        const responseBody = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(responseBody.summary).toEqual({ acceptedCount: 1, retryableFailureCount: 1, blockedCount: 0 });
        expect(JSON.stringify(responseBody)).not.toMatch(/providerReference|inviteLink|token/i);
        expect(deliverInvitations).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "authorized", user: expect.objectContaining({ id: RECRUITER_ID }) }),
            expect.not.objectContaining({ recruiterId: expect.anything() }),
            "https://interviewcoach.example",
        );
    });

    it("rejects JSON that attempts to select recipients or recruiter ownership", async () => {
        const response = await createRecruiterInvitationDeliveryRouteHandler({ resolveAccess: authorizedAccess })(
            request({ ...body(), recruiterId: RECRUITER_ID, recipientIds: ["recipient-1"] }),
        );
        expect(response.status).toBe(400);
    });

    it("rejects an oversized body before invoking delivery", async () => {
        const deliverInvitations = vi.fn();
        const response = await createRecruiterInvitationDeliveryRouteHandler({
            resolveAccess: authorizedAccess,
            deliverInvitations,
        })(new NextRequest("http://localhost:3000/api/recruiter/invitations/delivery", {
            method: "POST",
            headers: { "content-type": "application/json", "content-length": "20000" },
            body: JSON.stringify(body()),
        }));
        expect(response.status).toBe(413);
        expect(deliverInvitations).not.toHaveBeenCalled();
    });
});

const RECRUITER_ID = "20000000-0000-4000-8000-000000000001";
const BATCH_ID = "40000000-0000-4000-8000-000000000001";

async function authorizedAccess() {
    return {
        kind: "authorized" as const,
        user: {
            id: RECRUITER_ID,
            email: "recruiter@example.com",
            displayName: "Dev Recruiter",
            status: "active" as const,
            roles: ["recruiter" as const],
        },
    };
}

function request(value: unknown) {
    return new NextRequest("http://localhost:3000/api/recruiter/invitations/delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
    });
}

function body() {
    return { batchId: BATCH_ID, actionKey: "browser-delivery-action-1" };
}
