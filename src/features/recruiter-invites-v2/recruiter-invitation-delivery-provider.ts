import nodemailer from "nodemailer";

import type { RecruiterInvitationMessage } from "./recruiter-invitation-message";

export type RecruiterInvitationDeliveryProvider = {
    name: string;
    send(input: {
        attemptId: string;
        recipientEmail: string;
        message: RecruiterInvitationMessage;
    }): Promise<{ providerReferenceId: string }>;
};

export class RecruiterInvitationProviderError extends Error {
    constructor(
        readonly code: string,
        readonly retryable: boolean,
        readonly outcomeKnown: boolean,
        message = "Invitation delivery provider failed.",
    ) {
        super(message);
        this.name = "RecruiterInvitationProviderError";
    }
}

export function createRecruiterInvitationDeliveryProvider(
    env: Readonly<Record<string, string | undefined>> = process.env,
): RecruiterInvitationDeliveryProvider {
    const selected = env.RECRUITER_INVITATION_DELIVERY_PROVIDER?.trim().toLowerCase();

    if (selected === "fixture") {
        if (env.NODE_ENV === "production") {
            return unavailableProvider("fixture_not_allowed");
        }
        return {
            name: "fixture",
            async send(input) {
                return { providerReferenceId: `fixture-${input.attemptId}` };
            },
        };
    }

    if (selected && selected !== "smtp") {
        return unavailableProvider("provider_unsupported");
    }

    const username = env.SMTP_USERNAME?.trim();
    const password = env.SMTP_PASSWORD?.trim();
    if (!username || !password || selected !== "smtp") {
        return unavailableProvider("provider_not_configured");
    }

    const port = parseSmtpPort(env.SMTP_PORT);
    const host = env.SMTP_HOST?.trim() || "email-smtp.us-east-1.amazonaws.com";
    const from = env.SMTP_FROM_EMAIL?.trim() || "Rangam Interview Coach <interviews@coach.rangam.com>";
    if (!port || /[\r\n]/.test(host) || /[\r\n]/.test(from)) {
        return unavailableProvider("smtp_configuration_invalid");
    }
    const messageDomain = readMessageDomain(from);
    const transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: port !== 465,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
        tls: { minVersion: "TLSv1.2" },
        auth: { user: username, pass: password },
    });

    return {
        name: "smtp",
        async send(input) {
            try {
                const result = await transport.sendMail({
                    from,
                    to: input.recipientEmail,
                    subject: input.message.subject,
                    text: input.message.text,
                    html: input.message.html,
                    messageId: `<invite-${input.attemptId}@${messageDomain}>`,
                });
                const accepted = Array.isArray(result.accepted) ? result.accepted.length : 0;
                const rejected = Array.isArray(result.rejected) ? result.rejected.length : 0;
                if (accepted !== 1 || rejected > 0 || !result.messageId?.trim()) {
                    throw new RecruiterInvitationProviderError(
                        "recipient_not_accepted",
                        false,
                        true,
                        "SMTP did not accept the invitation recipient.",
                    );
                }
                return { providerReferenceId: result.messageId.trim() };
            } catch (error) {
                if (error instanceof RecruiterInvitationProviderError) throw error;
                throw classifySmtpError(error);
            }
        },
    };
}

function unavailableProvider(code: string): RecruiterInvitationDeliveryProvider {
    return {
        name: "smtp",
        async send() {
            throw new RecruiterInvitationProviderError(code, true, true);
        },
    };
}

function classifySmtpError(error: unknown) {
    const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
    const code = typeof record.code === "string" ? record.code.toUpperCase() : "";
    const responseCode = Number(record.responseCode);
    if (code === "EAUTH") {
        return new RecruiterInvitationProviderError("smtp_authentication_failed", true, true);
    }
    if (code === "EENVELOPE" || (Number.isFinite(responseCode) && responseCode >= 500)) {
        return new RecruiterInvitationProviderError("smtp_recipient_rejected", false, true);
    }
    return new RecruiterInvitationProviderError("smtp_outcome_unknown", false, false);
}

function parseSmtpPort(value: string | undefined) {
    if (!value?.trim()) return 587;
    const port = Number(value);
    return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : null;
}

function readMessageDomain(from: string) {
    const match = from.match(/@([a-z0-9.-]+)>?$/i);
    return match?.[1] ?? "interviewcoach.local";
}
