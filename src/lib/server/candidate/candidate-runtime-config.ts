import { getOptionalServerEnv, isProductionServer } from "@/lib/server/config/server-env";

export type CandidateAuthMode = "external" | "password" | "mock";
export type CandidateDataBackend = "postgres";

export type CandidateRuntimeConfig = {
    authMode: CandidateAuthMode;
    dataBackend: CandidateDataBackend;
};

export function getCandidateRuntimeConfig(): CandidateRuntimeConfig {
    const authMode = getCandidateAuthMode();

    if (isProductionServer() && (authMode === "password" || authMode === "mock")) {
        throw new Error(`CANDIDATE_AUTH_MODE=${authMode} is not allowed in production.`);
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

    if (configured === "external" || configured === "password" || configured === "mock") {
        return configured;
    }

    throw new Error(
        `Unsupported CANDIDATE_AUTH_MODE value "${configured}". Expected "external", "password", or "mock".`
    );
}
