import { hashPassword } from "@/features/app-auth-v2/password";

import type { CandidateRegistrationRequest } from "./candidate-account-contract";
import { normalizeCandidatePhone } from "./candidate-account-contract";
import {
    createCandidateAccountEmailProvider,
    CandidateAccountEmailProviderError,
    type CandidateAccountEmailProvider,
} from "./candidate-account-email-provider";
import {
    generateCandidateEmailVerificationToken,
    getCandidateEmailVerificationExpiry,
    hashCandidateEmailVerificationToken,
} from "./candidate-email-verification-token";
import { getCandidatePolicyManifest } from "./candidate-policy-manifest";
import {
    CandidateAccountRepository,
    type CandidateVerificationConsumeResult,
} from "./candidate-account-repository";

export type CandidateAccountRequestMetadata = {
    ipAddress: string | null;
    userAgent: string | null;
};

export type CandidateAccountServiceDependencies = {
    repository?: CandidateAccountRepository;
    emailProvider?: CandidateAccountEmailProvider;
    now?: () => Date;
    token?: () => string;
    hashPassword?: (password: string) => Promise<string>;
    env?: Readonly<Record<string, string | undefined>>;
};

export type CandidateVerificationDeliveryResult =
    | {
        outcome: "accepted";
        developmentVerificationUrl?: string;
    }
    | { outcome: "delivery_failed" };

export async function registerCandidateAccount(
    input: CandidateRegistrationRequest,
    metadata: CandidateAccountRequestMetadata,
    appOrigin: string,
    dependencies: CandidateAccountServiceDependencies = {},
): Promise<CandidateVerificationDeliveryResult> {
    const phoneE164 = normalizeCandidatePhone(input.phone);
    if (!phoneE164) throw new Error("Candidate phone normalization failed.");

    const env = dependencies.env ?? process.env;
    const repository = dependencies.repository ?? new CandidateAccountRepository();
    const provider = dependencies.emailProvider ?? createCandidateAccountEmailProvider(env);
    const now = dependencies.now?.() ?? new Date();
    const rawToken = dependencies.token?.() ?? generateCandidateEmailVerificationToken();
    const tokenHash = hashCandidateEmailVerificationToken(rawToken);
    const expiresAt = getCandidateEmailVerificationExpiry(now, env);
    const policy = getCandidatePolicyManifest(env);
    const passwordHash = await (dependencies.hashPassword ?? hashPassword)(input.password);
    const persisted = await repository.register({
        email: input.email.trim().toLowerCase(),
        passwordHash,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phoneE164,
        postalCode: input.postalCode.trim(),
        contactPreferences: input.contactPreferences,
        contactAuthorization: input.contactAuthorization,
        ...policy,
        verificationTokenHash: tokenHash,
        verificationExpiresAt: expiresAt.toISOString(),
        ...metadata,
    });

    if (persisted.outcome === "exists") {
        return { outcome: "accepted" };
    }

    const verificationUrl = createVerificationUrl(appOrigin, rawToken);
    return deliverVerification({
        repository,
        provider,
        userId: persisted.userId,
        firstName: input.firstName.trim(),
        email: input.email.trim().toLowerCase(),
        verificationUrl,
        tokenHash,
        env,
    });
}

export async function resendCandidateEmailVerification(
    email: string,
    appOrigin: string,
    dependencies: CandidateAccountServiceDependencies = {},
): Promise<CandidateVerificationDeliveryResult> {
    const env = dependencies.env ?? process.env;
    const repository = dependencies.repository ?? new CandidateAccountRepository();
    const provider = dependencies.emailProvider ?? createCandidateAccountEmailProvider(env);
    const now = dependencies.now?.() ?? new Date();
    const rawToken = dependencies.token?.() ?? generateCandidateEmailVerificationToken();
    const tokenHash = hashCandidateEmailVerificationToken(rawToken);
    const issued = await repository.issueVerification({
        email: email.trim().toLowerCase(),
        tokenHash,
        expiresAt: getCandidateEmailVerificationExpiry(now, env).toISOString(),
    });

    if (issued.outcome !== "issued") {
        return { outcome: "accepted" };
    }

    return deliverVerification({
        repository,
        provider,
        userId: issued.userId,
        firstName: issued.firstName ?? "there",
        email: email.trim().toLowerCase(),
        verificationUrl: createVerificationUrl(appOrigin, rawToken),
        tokenHash,
        env,
    });
}

export async function consumeCandidateEmailVerification(
    rawToken: string,
    dependencies: Pick<CandidateAccountServiceDependencies, "repository"> = {},
): Promise<CandidateVerificationConsumeResult> {
    const repository = dependencies.repository ?? new CandidateAccountRepository();
    return repository.consumeVerification(hashCandidateEmailVerificationToken(rawToken));
}

async function deliverVerification(input: {
    repository: CandidateAccountRepository;
    provider: CandidateAccountEmailProvider;
    userId: string;
    firstName: string;
    email: string;
    verificationUrl: string;
    tokenHash: string;
    env: Readonly<Record<string, string | undefined>>;
}): Promise<CandidateVerificationDeliveryResult> {
    try {
        await input.provider.sendVerification({
            recipientEmail: input.email,
            firstName: input.firstName,
            verificationUrl: input.verificationUrl,
        });
        await recordDeliverySafely(input.repository, {
            userId: input.userId,
            outcome: "success",
            provider: input.provider.name,
            reason: "provider_accepted",
        });
        return {
            outcome: "accepted",
            ...(input.provider.name === "fixture" && input.env.NODE_ENV !== "production"
                ? { developmentVerificationUrl: input.verificationUrl }
                : {}),
        };
    } catch (error) {
        await input.repository.invalidateVerification(input.tokenHash);
        const reason = error instanceof CandidateAccountEmailProviderError
            ? error.code
            : "provider_failure";
        await recordDeliverySafely(input.repository, {
            userId: input.userId,
            outcome: "failed",
            provider: input.provider.name,
            reason,
        });
        return { outcome: "delivery_failed" };
    }
}

async function recordDeliverySafely(
    repository: CandidateAccountRepository,
    input: Parameters<CandidateAccountRepository["recordEmailDelivery"]>[0],
) {
    try {
        await repository.recordEmailDelivery(input);
    } catch {
        // Authentication delivery remains authoritative when audit telemetry is degraded.
    }
}

function createVerificationUrl(appOrigin: string, rawToken: string) {
    const url = new URL("/candidate/verify-email", appOrigin);
    url.searchParams.set("token", rawToken);
    return url.toString();
}
