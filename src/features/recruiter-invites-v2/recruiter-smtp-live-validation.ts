export const RECRUITER_SMTP_LIVE_ACKNOWLEDGEMENT = "SEND_ONE_REAL_INVITATION";

export class RecruiterSmtpLiveValidationGuardError extends Error {
    constructor(readonly code: string, message: string) {
        super(message);
        this.name = "RecruiterSmtpLiveValidationGuardError";
    }
}

export type RecruiterSmtpLiveValidationConfig = {
    recipientEmail: string;
    appOrigin: string;
};

export type RecruiterSmtpLiveValidationSummary = {
    ok: true;
    validationRunId: string;
    provider: "smtp";
    providerAccepted: true;
    attemptNumber: number;
    handoffRecovered: true;
    dashboardRecovered: true;
    acceptedResendSuppressed: true;
    providerCallCount: 1;
    ownerFenceVerified: true;
    temporaryAggregateRemoved: true;
};

export function readRecruiterSmtpLiveValidationConfig(
    env: Readonly<Record<string, string | undefined>>,
): RecruiterSmtpLiveValidationConfig {
    if (env.NODE_ENV?.trim().toLowerCase() === "production") {
        throw guardError("production_forbidden", "Live SMTP validation cannot run in production mode.");
    }
    if (env.RECRUITER_SMTP_LIVE_VALIDATION?.trim() !== RECRUITER_SMTP_LIVE_ACKNOWLEDGEMENT) {
        throw guardError(
            "acknowledgement_required",
            `Set RECRUITER_SMTP_LIVE_VALIDATION=${RECRUITER_SMTP_LIVE_ACKNOWLEDGEMENT} to acknowledge one real email.`,
        );
    }
    if (env.RECRUITER_INVITATION_DELIVERY_PROVIDER?.trim().toLowerCase() !== "smtp") {
        throw guardError("smtp_provider_required", "Live SMTP validation requires the smtp delivery provider.");
    }

    const recipientEmail = normalizeEmail(env.RECRUITER_SMTP_LIVE_RECIPIENT);
    const appOrigin = normalizeOrigin(env.RECRUITER_SMTP_LIVE_APP_ORIGIN);

    requireValue(env.SMTP_HOST, "smtp_host_required", "Set an explicit SMTP_HOST for live validation.");
    requireSmtpPort(env.SMTP_PORT);
    requireValue(env.SMTP_USERNAME, "smtp_username_required", "Set SMTP_USERNAME for live validation.");
    requireValue(env.SMTP_PASSWORD, "smtp_password_required", "Set SMTP_PASSWORD for live validation.");
    requireValue(env.SMTP_FROM_EMAIL, "smtp_from_required", "Set SMTP_FROM_EMAIL for live validation.");
    const encryptionSecret = requireValue(
        env.ENCRYPTION_SECRET,
        "encryption_secret_required",
        "Set ENCRYPTION_SECRET for temporary invitation-token encryption.",
    );
    if (encryptionSecret.length < 32) {
        throw guardError("encryption_secret_invalid", "ENCRYPTION_SECRET must contain at least 32 characters.");
    }

    for (const [name, value] of [
        ["SMTP_HOST", env.SMTP_HOST],
        ["SMTP_USERNAME", env.SMTP_USERNAME],
        ["SMTP_FROM_EMAIL", env.SMTP_FROM_EMAIL],
    ] as const) {
        if (/\r|\n/.test(value ?? "")) {
            throw guardError("smtp_configuration_invalid", `${name} contains unsupported control characters.`);
        }
    }

    return { recipientEmail, appOrigin };
}

export function createRecruiterSmtpLiveValidationSummary(input: {
    validationRunId: string;
    attemptNumber: number;
    handoffRecovered: boolean;
    dashboardRecovered: boolean;
    acceptedResendSuppressed: boolean;
    providerCallCount: number;
    ownerFenceVerified: boolean;
    temporaryAggregateRemoved: boolean;
}): RecruiterSmtpLiveValidationSummary {
    if (
        !input.validationRunId
        || input.attemptNumber !== 1
        || !input.handoffRecovered
        || !input.dashboardRecovered
        || !input.acceptedResendSuppressed
        || input.providerCallCount !== 1
        || !input.ownerFenceVerified
        || !input.temporaryAggregateRemoved
    ) {
        throw new RecruiterSmtpLiveValidationGuardError(
            "acceptance_incomplete",
            "Live SMTP validation did not satisfy every acceptance invariant.",
        );
    }
    return {
        ok: true,
        validationRunId: input.validationRunId,
        provider: "smtp",
        providerAccepted: true,
        attemptNumber: 1,
        handoffRecovered: true,
        dashboardRecovered: true,
        acceptedResendSuppressed: true,
        providerCallCount: 1,
        ownerFenceVerified: true,
        temporaryAggregateRemoved: true,
    };
}

function normalizeEmail(value: string | undefined) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        throw guardError(
            "recipient_required",
            "Set RECRUITER_SMTP_LIVE_RECIPIENT to the one approved test mailbox.",
        );
    }
    return normalized;
}

function normalizeOrigin(value: string | undefined) {
    const raw = value?.trim();
    if (!raw) {
        throw guardError("app_origin_required", "Set RECRUITER_SMTP_LIVE_APP_ORIGIN explicitly.");
    }
    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        throw guardError("app_origin_invalid", "RECRUITER_SMTP_LIVE_APP_ORIGIN must be an absolute HTTP(S) origin.");
    }
    const blockedHostnames = new Set(["0.0.0.0", "::", "[::]"]);
    if (
        !["http:", "https:"].includes(parsed.protocol)
        || blockedHostnames.has(parsed.hostname)
        || parsed.username
        || parsed.password
        || parsed.search
        || parsed.hash
        || (parsed.pathname !== "/" && parsed.pathname !== "")
    ) {
        throw guardError("app_origin_invalid", "RECRUITER_SMTP_LIVE_APP_ORIGIN must be a usable HTTP(S) origin without credentials, path, query, or fragment.");
    }
    return parsed.origin;
}

function requireSmtpPort(value: string | undefined) {
    const normalized = requireValue(value, "smtp_port_required", "Set an explicit SMTP_PORT for live validation.");
    const port = Number(normalized);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw guardError("smtp_port_invalid", "SMTP_PORT must be an integer between 1 and 65535.");
    }
}

function requireValue(value: string | undefined, code: string, message: string) {
    const normalized = value?.trim();
    if (!normalized) throw guardError(code, message);
    return normalized;
}

function guardError(code: string, message: string) {
    return new RecruiterSmtpLiveValidationGuardError(code, message);
}
