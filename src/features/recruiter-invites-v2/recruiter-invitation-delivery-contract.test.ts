import { describe, expect, it } from "vitest";

import {
    parseRecruiterInvitationDeliveryRequest,
    RecruiterInvitationDeliveryValidationError,
} from "./recruiter-invitation-delivery-contract";

describe("recruiter invitation delivery request", () => {
    it("accepts only a batch and browser action key", () => {
        expect(parseRecruiterInvitationDeliveryRequest({
            batchId: "40000000-0000-4000-8000-000000000001",
            actionKey: "browser-delivery-action-1",
        })).toEqual({
            batchId: "40000000-0000-4000-8000-000000000001",
            actionKey: "browser-delivery-action-1",
        });
    });

    it("rejects body-owned recruiter identity and recipient content", () => {
        expect(() => parseRecruiterInvitationDeliveryRequest({
            batchId: "40000000-0000-4000-8000-000000000001",
            actionKey: "browser-delivery-action-1",
            recruiterId: "20000000-0000-4000-8000-000000000001",
        })).toThrow(RecruiterInvitationDeliveryValidationError);
    });
});
