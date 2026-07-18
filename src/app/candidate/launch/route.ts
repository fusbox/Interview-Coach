import { randomUUID } from "node:crypto";

import {
    handleCandidateHostLaunchRequest,
    type CandidateHostLaunchRouteDiagnostic,
    type CandidateHostLaunchRouteDependencies,
} from "@/features/candidate-auth-v2/host-launch-route";
import {
    CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV,
    isCandidateDevHostLaunchEnabled,
    resolveCandidateDevHostLaunchProfile,
    verifyCandidateDevHostLaunchToken,
} from "@/features/candidate-auth-v2/dev-host-launch";
import { createCandidateProductionHostLaunchRouteDependencies } from "@/features/candidate-auth-v2/production-host-launch-runtime";

const pendingProductionLaunchDependencies: CandidateHostLaunchRouteDependencies = {
    async verifyLaunchToken() {
        return null;
    },
    async resolveCandidateProfile() {
        throw new Error("Candidate host launch profile resolution is not configured.");
    },
};

export async function GET(request: Request) {
    const now = new Date();
    const requestId = randomUUID();
    const devLaunchEnabled = isCandidateDevHostLaunchEnabled();
    return handleCandidateHostLaunchRequest({
        requestUrl: request.url,
        now,
        requestId,
        ...getCandidateLaunchDependencies(now, requestId, devLaunchEnabled),
        onDiagnostic: devLaunchEnabled ? undefined : logCandidateHostLaunchDiagnostic,
    });
}

function getCandidateLaunchDependencies(
    now: Date,
    requestId: string,
    devLaunchEnabled: boolean,
): CandidateHostLaunchRouteDependencies {
    if (!devLaunchEnabled) {
        const productionDependencies = createCandidateProductionHostLaunchRouteDependencies({
            now,
            onVerificationDiagnostic(reason) {
                logCandidateHostLaunchDiagnostic({
                    requestId,
                    phase: "verification",
                    outcome: "rejected",
                    reason,
                });
            },
        });
        if (productionDependencies) {
            return productionDependencies;
        }

        logCandidateHostLaunchDiagnostic({
            requestId,
            phase: "assembly",
            outcome: "rejected",
            reason: "runtime_unavailable",
        });
        return pendingProductionLaunchDependencies;
    }

    const secret = process.env[CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV]?.trim();
    if (!secret) {
        return pendingProductionLaunchDependencies;
    }

    return {
        verifyLaunchToken(token) {
            return verifyCandidateDevHostLaunchToken({
                token,
                secret,
                now,
            });
        },
        resolveCandidateProfile: resolveCandidateDevHostLaunchProfile,
    };
}

type CandidateHostLaunchSafeDiagnostic = CandidateHostLaunchRouteDiagnostic | {
    requestId: string;
    phase: "assembly" | "verification";
    outcome: "rejected";
    reason: string;
};

function logCandidateHostLaunchDiagnostic(diagnostic: CandidateHostLaunchSafeDiagnostic) {
    if (diagnostic.outcome === "accepted") {
        console.info("[candidate-host-launch]", diagnostic);
        return;
    }

    console.warn("[candidate-host-launch]", diagnostic);
}
