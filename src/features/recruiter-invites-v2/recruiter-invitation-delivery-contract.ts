import { z } from "zod";

const deliveryRequestSchema = z.object({
    batchId: z.string().uuid(),
    actionKey: z.string().trim().min(16).max(200),
}).strict();

export type RecruiterInvitationDeliveryRequest = z.infer<typeof deliveryRequestSchema>;

export class RecruiterInvitationDeliveryValidationError extends Error {}

export function parseRecruiterInvitationDeliveryRequest(value: unknown): RecruiterInvitationDeliveryRequest {
    const parsed = deliveryRequestSchema.safeParse(value);
    if (!parsed.success) {
        throw new RecruiterInvitationDeliveryValidationError("Invalid invitation delivery request.");
    }
    return parsed.data;
}
