import { getOptionalServerEnv, isProductionServer } from "@/lib/server/config/server-env";

export type CandidateAuthMode = "external" | "dev" | "password" | "mock" | "preview_test";
export type CandidateDataBackend = "postgres";

export type CandidateRuntimeConfig = {
    authMode: CandidateAuthMode;
    dataBackend: CandidateDataBackend;
};

export function getCandidateRuntimeConfig(): CandidateRuntimeConfig {
    const authMode = getCandidateAuthMode();

    if (isProductionServer() && (authMode === "dev" || authMode === "password" || authMode === "mock")) {
        throw new Error(`CANDIDATE_AUTH_MODE=${authMode} is not allowed in production.`);
    }

    if (isProductionServer() && authMode === "preview_test" && !isPreviewTestAuthAllowed()) {
        throw new Error("CANDIDATE_AUTH_MODE=preview_test requires VERCEL_ENV=preview and ALLOW_CANDIDATE_PREVIEW_AUTH=true.");
    }

    return {
        authMode,
        dataBackend: getCandidateDataBackend(),
    };
}

export function getCandidateDataBackend(): CandidateDataBackend {
    const configured = getOptionalServerEnv("CANDIDATE_DATA_BACKEND")?.toLowerCase() ?? "postgres";

    if (configured === "postgres") {
        return configured;
    }

    throw new Error(`Unsupported CANDIDATE_DATA_BACKEND value "${configured}". Expected "postgres".`);
}

export function getCandidateAuthMode(): CandidateAuthMode {
    const configured = getOptionalServerEnv("CANDIDATE_AUTH_MODE")?.toLowerCase() ?? "external";

    if (configured === "external" || configured === "dev" || configured === "password" || configured === "mock" || configured === "preview_test") {
        return configured;
    }

    throw new Error(
        `Unsupported CANDIDATE_AUTH_MODE value "${configured}". Expected "external", "dev", "password", "mock", or "preview_test".`
    );
}

function isPreviewTestAuthAllowed(): boolean {
    return getOptionalServerEnv("VERCEL_ENV") === "preview"
        && getOptionalServerEnv("ALLOW_CANDIDATE_PREVIEW_AUTH")?.toLowerCase() === "true";
}
