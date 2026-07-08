import {
    handleCandidateHostLaunchRequest,
    type CandidateHostLaunchRouteDependencies,
} from "@/features/candidate-auth-v2/host-launch-route";

const pendingProductionLaunchDependencies: CandidateHostLaunchRouteDependencies = {
    async verifyLaunchToken() {
        return null;
    },
    async resolveCandidateProfile() {
        throw new Error("Candidate host launch profile resolution is not configured.");
    },
};

export async function GET(request: Request) {
    return handleCandidateHostLaunchRequest({
        requestUrl: request.url,
        now: new Date(),
        ...pendingProductionLaunchDependencies,
    });
}
