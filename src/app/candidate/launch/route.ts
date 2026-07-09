import {
    handleCandidateHostLaunchRequest,
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
    return handleCandidateHostLaunchRequest({
        requestUrl: request.url,
        now,
        ...getCandidateLaunchDependencies(now),
    });
}

function getCandidateLaunchDependencies(now: Date): CandidateHostLaunchRouteDependencies {
    if (!isCandidateDevHostLaunchEnabled()) {
        return createCandidateProductionHostLaunchRouteDependencies({ now }) ?? pendingProductionLaunchDependencies;
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
