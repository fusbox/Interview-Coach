import nodemailer from "nodemailer";

export type CandidateAccountEmailProvider = {
    name: string;
    sendVerification(input: {
        recipientEmail: string;
        firstName: string;
        verificationUrl: string;
    }): Promise<{ providerReferenceId: string }>;
    sendPasswordReset(input: {
        recipientEmail: string;
        firstName: string;
        resetUrl: string;
        expiresInMinutes: number;
    }): Promise<{ providerReferenceId: string }>;
};

export class CandidateAccountEmailProviderError extends Error {
    constructor(
        readonly code: string,
        readonly outcomeKnown: boolean,
    ) {
        super("Candidate account email delivery failed.");
        this.name = "CandidateAccountEmailProviderError";
    }
}

export function createCandidateAccountEmailProvider(
    env: Readonly<Record<string, string | undefined>> = process.env,
): CandidateAccountEmailProvider {
    const selected = env.CANDIDATE_ACCOUNT_EMAIL_PROVIDER?.trim().toLowerCase();
    if (selected === "fixture") {
        if (env.NODE_ENV === "production") return unavailable("fixture_not_allowed");
        return {
            name: "fixture",
            async sendVerification(input) {
                return {
                    providerReferenceId: `fixture-${Buffer.from(input.recipientEmail).toString("base64url")}`,
                };
            },
            async sendPasswordReset(input) {
                return {
                    providerReferenceId: `fixture-${Buffer.from(input.recipientEmail).toString("base64url")}`,
                };
            },
        };
    }

    if (selected !== "smtp") return unavailable("provider_not_configured");
    const username = env.SMTP_USERNAME?.trim();
    const password = env.SMTP_PASSWORD?.trim();
    const host = env.SMTP_HOST?.trim() || "email-smtp.us-east-1.amazonaws.com";
    const port = parsePort(env.SMTP_PORT);
    const from = env.CANDIDATE_ACCOUNT_FROM_EMAIL?.trim()
        || env.SMTP_FROM_EMAIL?.trim()
        || "TalentArbor Interview Coach <interviews@coach.rangam.com>";
    if (!username || !password || !port || /[\r\n]/.test(host) || /[\r\n]/.test(from)) {
        return unavailable("smtp_configuration_invalid");
    }

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
        async sendVerification(input) {
            return sendSmtpMessage({
                recipientEmail: input.recipientEmail,
                subject: "Verify your Interview Coach account",
                text: createVerificationTextMessage(input),
                html: createVerificationHtmlMessage(input),
            });
        },
        async sendPasswordReset(input) {
            return sendSmtpMessage({
                recipientEmail: input.recipientEmail,
                subject: "Reset your Interview Coach password",
                text: createPasswordResetTextMessage(input),
                html: createPasswordResetHtmlMessage(input),
            });
        },
    };

    async function sendSmtpMessage(input: {
        recipientEmail: string;
        subject: string;
        text: string;
        html: string;
    }) {
        try {
            const result = await transport.sendMail({
                from,
                to: input.recipientEmail,
                subject: input.subject,
                text: input.text,
                html: input.html,
            });
            const accepted = Array.isArray(result.accepted) ? result.accepted.length : 0;
            const rejected = Array.isArray(result.rejected) ? result.rejected.length : 0;
            if (accepted !== 1 || rejected > 0 || !result.messageId?.trim()) {
                throw new CandidateAccountEmailProviderError("recipient_not_accepted", true);
            }
            return { providerReferenceId: result.messageId.trim() };
        } catch (error) {
            if (error instanceof CandidateAccountEmailProviderError) throw error;
            const code = readErrorCode(error);
            throw new CandidateAccountEmailProviderError(
                code === "EAUTH" ? "smtp_authentication_failed" : "smtp_outcome_unknown",
                code === "EAUTH",
            );
        }
    }
}

function unavailable(code: string): CandidateAccountEmailProvider {
    return {
        name: "unavailable",
        async sendVerification() {
            throw new CandidateAccountEmailProviderError(code, true);
        },
        async sendPasswordReset() {
            throw new CandidateAccountEmailProviderError(code, true);
        },
    };
}

function createVerificationTextMessage(input: {
    firstName: string;
    verificationUrl: string;
}) {
    return [
        `Hi ${input.firstName},`,
        "",
        "Verify your email to finish creating your Interview Coach account:",
        input.verificationUrl,
        "",
        "If you did not create this account, you can ignore this message.",
    ].join("\n");
}

function createVerificationHtmlMessage(input: {
    firstName: string;
    verificationUrl: string;
}) {
    const firstName = escapeHtml(input.firstName);
    const href = escapeHtml(input.verificationUrl);
    return `<p>Hi ${firstName},</p><p>Verify your email to finish creating your Interview Coach account.</p><p><a href="${href}">Verify email</a></p><p>If you did not create this account, you can ignore this message.</p>`;
}

function createPasswordResetTextMessage(input: {
    firstName: string;
    resetUrl: string;
    expiresInMinutes: number;
}) {
    return [
        `Hi ${input.firstName},`,
        "",
        `Use this link within ${input.expiresInMinutes} minutes to reset your Interview Coach password:`,
        input.resetUrl,
        "",
        "If you did not request a password reset, you can ignore this message.",
    ].join("\n");
}

function createPasswordResetHtmlMessage(input: {
    firstName: string;
    resetUrl: string;
    expiresInMinutes: number;
}) {
    const firstName = escapeHtml(input.firstName);
    const href = escapeHtml(input.resetUrl);
    return `<p>Hi ${firstName},</p><p>Use this link within ${input.expiresInMinutes} minutes to reset your Interview Coach password.</p><p><a href="${href}">Reset password</a></p><p>If you did not request a password reset, you can ignore this message.</p>`;
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character] ?? character);
}

function parsePort(value: string | undefined) {
    if (!value?.trim()) return 587;
    const port = Number(value);
    return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : null;
}

function readErrorCode(error: unknown) {
    if (!error || typeof error !== "object") return "";
    const code = (error as Record<string, unknown>).code;
    return typeof code === "string" ? code.toUpperCase() : "";
}
