import { hashPassword } from "@/features/app-auth-v2/password";

import {
    createCandidateAccountEmailProvider,
    CandidateAccountEmailProviderError,
    type CandidateAccountEmailProvider,
} from "./candidate-account-email-provider";
import type { CandidateAccountRequestMetadata } from "./candidate-account-service";
import {
    CandidatePasswordRecoveryRepository,
    type CandidatePasswordResetConsumeResult,
} from "./candidate-password-recovery-repository";
import {
    generateCandidatePasswordResetToken,
    getCandidatePasswordResetExpiry,
    hashCandidatePasswordResetToken,
} from "./candidate-password-reset-token";

type CandidatePasswordRecoveryDependencies = {
    repository?: CandidatePasswordRecoveryRepository;
    emailProvider?: CandidateAccountEmailProvider;
    now?: () => Date;
    token?: () => string;
    hashPassword?: (password: string) => Promise<string>;
    env?: Readonly<Record<string, string | undefined>>;
};

export type CandidatePasswordResetDeliveryResult =
    | { outcome: "accepted"; developmentResetUrl?: string }
    | { outcome: "delivery_failed" };

export async function requestCandidatePasswordReset(
    email: string,
    appOrigin: string,
    dependencies: CandidatePasswordRecoveryDependencies = {},
): Promise<CandidatePasswordResetDeliveryResult> {
    const env = dependencies.env ?? process.env;
    const repository = dependencies.repository ?? new CandidatePasswordRecoveryRepository();
    const provider = dependencies.emailProvider ?? createCandidateAccountEmailProvider(env);
    const now = dependencies.now?.() ?? new Date();
    const rawToken = dependencies.token?.() ?? generateCandidatePasswordResetToken();
    const tokenHash = hashCandidatePasswordResetToken(rawToken);
    const expiresAt = getCandidatePasswordResetExpiry(now, env);
    const issued = await repository.issue({
        email: email.trim().toLowerCase(),
        tokenHash,
        expiresAt: expiresAt.toISOString(),
    });

    if (issued.outcome !== "issued") {
        return { outcome: "accepted" };
    }

    const resetUrl = createPasswordResetUrl(appOrigin, rawToken);
    try {
        await provider.sendPasswordReset({
            recipientEmail: email.trim().toLowerCase(),
            firstName: issued.firstName ?? "there",
            resetUrl,
            expiresInMinutes: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 60_000)),
        });
        await recordDeliverySafely(repository, {
            userId: issued.userId,
            outcome: "success",
            provider: provider.name,
            reason: "provider_accepted",
        });
        return {
            outcome: "accepted",
            ...(provider.name === "fixture" && env.NODE_ENV !== "production"
                ? { developmentResetUrl: resetUrl }
                : {}),
        };
    } catch (error) {
        await repository.invalidate(tokenHash);
        await recordDeliverySafely(repository, {
            userId: issued.userId,
            outcome: "failed",
            provider: provider.name,
            reason: error instanceof CandidateAccountEmailProviderError
                ? error.code
                : "provider_failure",
        });
        return { outcome: "delivery_failed" };
    }
}

export async function consumeCandidatePasswordReset(
    input: {
        token: string;
        password: string;
    },
    metadata: CandidateAccountRequestMetadata,
    dependencies: CandidatePasswordRecoveryDependencies = {},
): Promise<CandidatePasswordResetConsumeResult> {
    const repository = dependencies.repository ?? new CandidatePasswordRecoveryRepository();
    const passwordHash = await (dependencies.hashPassword ?? hashPassword)(input.password);
    return repository.consume({
        tokenHash: hashCandidatePasswordResetToken(input.token),
        passwordHash,
        ...metadata,
    });
}

async function recordDeliverySafely(
    repository: CandidatePasswordRecoveryRepository,
    input: Parameters<CandidatePasswordRecoveryRepository["recordEmailDelivery"]>[0],
) {
    try {
        await repository.recordEmailDelivery(input);
    } catch {
        // Recovery remains authoritative when non-authoritative audit telemetry is degraded.
    }
}

function createPasswordResetUrl(appOrigin: string, rawToken: string) {
    const url = new URL("/candidate/reset-password", appOrigin);
    url.searchParams.set("token", rawToken);
    return url.toString();
}
