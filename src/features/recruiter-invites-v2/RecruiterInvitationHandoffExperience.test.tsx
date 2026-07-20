import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecruiterInvitationHandoffReadModel } from "./recruiter-invitation-handoff-read-model";
import { RecruiterInvitationHandoffExperience } from "./RecruiterInvitationHandoffExperience";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("RecruiterInvitationHandoffExperience", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        refreshMock.mockReset();
        Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    });

    it("copies the recovered link and message without mutating delivery state", async () => {
        render(<RecruiterInvitationHandoffExperience model={model()} />);

        fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://example.test/s/token"));
        fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Approved message"));
    });

    it("posts one batch action key and refreshes from the durable ledger", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            status: "delivery_processed",
            batchId: "batch-1",
            recipients: [{ recipientId: "recipient-1", status: "provider_accepted", retryable: false }],
        }), { status: 200, headers: { "content-type": "application/json" } })));
        render(<RecruiterInvitationHandoffExperience model={model()} />);

        fireEvent.click(screen.getByRole("button", { name: "Send pending invitations" }));

        await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
        expect(fetch).toHaveBeenCalledWith("/api/recruiter/invitations/delivery", expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"batchId":"batch-1"'),
        }));
        expect(await screen.findByText("Accepted by email provider")).toBeInTheDocument();
    });

    it("reuses the same browser action key after a response-lost retry", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Temporarily unavailable." }), {
                status: 503,
                headers: { "content-type": "application/json" },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                status: "delivery_processed",
                batchId: "batch-1",
                recipients: [{ recipientId: "recipient-1", status: "provider_accepted", retryable: false }],
            }), { status: 200, headers: { "content-type": "application/json" } }));
        vi.stubGlobal("fetch", fetchMock);
        render(<RecruiterInvitationHandoffExperience model={model()} />);

        fireEvent.click(screen.getByRole("button", { name: "Send pending invitations" }));
        await screen.findByText("Temporarily unavailable.", { selector: ".recruiter-handoff-alert" });
        fireEvent.click(screen.getByRole("button", { name: "Send pending invitations" }));
        await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));

        const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
        const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
        expect(secondBody.actionKey).toBe(firstBody.actionKey);
    });

    it("withholds delivery and copy controls when no recipient is policy-eligible", () => {
        const unavailable = model();
        unavailable.sendEligibleCount = 0;
        unavailable.recipients[0] = {
            ...unavailable.recipients[0]!,
            actionEligibility: null,
            linkAvailability: "expired",
            inviteLink: null,
            copyMessage: null,
        };
        render(<RecruiterInvitationHandoffExperience model={unavailable} />);

        expect(screen.queryByRole("button", { name: /send pending/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /copy link/i })).not.toBeInTheDocument();
        expect(screen.getByText(/personal invitation link has expired/i)).toBeInTheDocument();
    });
});

function model(): RecruiterInvitationHandoffReadModel {
    return {
        batchId: "batch-1",
        targetRole: "Quality Inspector",
        interviewStageLabel: "Screening call",
        createdAt: "2026-07-20T10:00:00.000Z",
        recipientCount: 1,
        lifecycleState: "ready",
        revision: "2026-07-20T10:00:00.000Z",
        sendEligibleCount: 1,
        retryEligibleCount: 0,
        recipients: [{
            recipientId: "recipient-1",
            candidateName: "Irma Castillo",
            email: "irma@example.invalid",
            requisitionReference: "REQ-10",
            sessionId: "session-1",
            sessionStateLabel: "Not started",
            sessionAttemptNumber: 1,
            deliveryState: "not_requested",
            deliveryLabel: "Not emailed",
            deliveryDetail: "Ready to send.",
            deliveryAttemptNumber: null,
            actionEligibility: "send",
            linkAvailability: "active",
            inviteLink: "https://example.test/s/token",
            copyMessage: "Approved message",
            tokenExpiresAt: "2026-07-27T10:00:00.000Z",
        }],
    };
}
