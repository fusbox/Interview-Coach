import { describe, expect, it } from "vitest";

import {
    candidateRegistrationRequestSchema,
    normalizeCandidatePhone,
} from "./candidate-account-contract";

const validRegistration = {
    firstName: "Sam",
    lastName: "Rivera",
    email: "sam@example.com",
    password: "long-password",
    phone: "(312) 555-0100",
    postalCode: "60601",
    contactPreferences: { email: true, sms: false, phone: false },
    contactAuthorization: true,
    platformPolicyAccepted: true,
    responsibleAiAcknowledged: true,
} as const;

describe("candidate account contract", () => {
    it("accepts the complete TA-aligned registration shape", () => {
        expect(candidateRegistrationRequestSchema.safeParse(validRegistration).success).toBe(true);
    });

    it("rejects malformed account contact fields at the request boundary", () => {
        for (const invalidContact of [
            { email: "sam@example" },
            { phone: "312-CALL-NOW" },
            { phone: "+01234567890" },
            { postalCode: "6060" },
            { postalCode: "60601-1234" },
            { postalCode: "A0601" },
        ]) {
            expect(candidateRegistrationRequestSchema.safeParse({
                ...validRegistration,
                ...invalidContact,
            }).success).toBe(false);
        }
    });

    it("keeps optional contact authorization aligned with selected channels", () => {
        expect(candidateRegistrationRequestSchema.safeParse({
            ...validRegistration,
            contactAuthorization: false,
        }).success).toBe(false);
        expect(candidateRegistrationRequestSchema.safeParse({
            ...validRegistration,
            contactPreferences: { email: false, sms: false, phone: false },
            contactAuthorization: false,
        }).success).toBe(true);
    });

    it("normalizes US and international phone input to E.164", () => {
        expect(normalizeCandidatePhone("(312) 555-0100")).toBe("+13125550100");
        expect(normalizeCandidatePhone("+44 20 7946 0958")).toBe("+442079460958");
        expect(normalizeCandidatePhone("312-CALL-NOW")).toBeNull();
        expect(normalizeCandidatePhone("++44 20 7946 0958")).toBeNull();
        expect(normalizeCandidatePhone("123")).toBeNull();
    });
});
