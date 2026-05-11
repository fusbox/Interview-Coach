import { getOptionalServerEnv } from "@/lib/server/config/server-env";

import { toCandidateProfileResolutionInput, type CandidateAuthHandoff } from "./candidate-auth-adapter";
import { getCandidateRuntimeConfig } from "./candidate-runtime-config";

const LOCAL_ISSUER = "interview-coach-local";
const DEFAULT_MOCK_EMAIL = "dev-candidate@example.invalid";
const DEFAULT_MOCK_DISPLAY_NAME = "Dev Candidate";

export async function resolveLocalCandidateAuthHandoff(): Promise<CandidateAuthHandoff | null> {
    const { authMode } = getCandidateRuntimeConfig();

    if (authMode === "external") {
        return null;
    }

    if (authMode === "mock") {
        return resolveMockCandidateAuthHandoff();
    }

    return resolvePasswordCandidateAuthHandoff();
}

function resolveMockCandidateAuthHandoff(): CandidateAuthHandoff {
    const email = getOptionalServerEnv("CANDIDATE_MOCK_EMAIL") ?? DEFAULT_MOCK_EMAIL;
    const normalizedEmail = email.trim().toLowerCase();
    const displayName = getOptionalServerEnv("CANDIDATE_MOCK_DISPLAY_NAME") ?? DEFAULT_MOCK_DISPLAY_NAME;

    return toCandidateProfileResolutionInput({
        provider: "dev_mock",
        issuer: LOCAL_ISSUER,
        subject: normalizedEmail,
        email: normalizedEmail,
        displayName,
        workspace: "local_dev",
    });
}

function resolvePasswordCandidateAuthHandoff(): CandidateAuthHandoff {
    const email = getOptionalServerEnv("CANDIDATE_DEV_EMAIL");
    if (!email) {
        throw new Error("CANDIDATE_DEV_EMAIL is required when CANDIDATE_AUTH_MODE=password.");
    }

    return toCandidateProfileResolutionInput({
        provider: "password",
        issuer: getOptionalServerEnv("CANDIDATE_DEV_ISSUER") ?? LOCAL_ISSUER,
        subject: getOptionalServerEnv("CANDIDATE_DEV_SUBJECT") ?? email,
        email,
        displayName: getOptionalServerEnv("CANDIDATE_DEV_DISPLAY_NAME") ?? null,
        workspace: "local_dev",
    });
}
