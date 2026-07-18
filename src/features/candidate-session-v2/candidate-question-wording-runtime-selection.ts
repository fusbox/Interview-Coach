import {
    CANDIDATE_HOST_LAUNCH_DEV_MODE_ENV,
    CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV,
} from "@/features/candidate-auth-v2/dev-host-launch";

import {
    GOOGLE_CANDIDATE_QUESTION_WORDING_PROVIDER,
    createGoogleCandidateQuestionWordingAdapterFromEnvironment,
    type GoogleCandidateQuestionWordingEnvironment,
    type GoogleCandidateQuestionWordingTransport,
} from "./google-candidate-question-wording";
import {
    CANDIDATE_QUESTION_WORDING_FAULT_MODE_ENV,
    CANDIDATE_QUESTION_WORDING_FAULT_MODES,
    CANDIDATE_QUESTION_WORDING_PROVIDER_ENV,
    CandidateQuestionWordingRuntimeError,
    createCandidateQuestionWordingRuntime,
    createFaultInjectionCandidateQuestionWordingRuntime,
    createFixtureCandidateQuestionWordingRuntime,
    type CandidateQuestionWordingFaultMode,
    type CandidateQuestionWordingRuntimeTelemetry,
} from "./candidate-question-wording-runtime";

export function createCandidateQuestionWordingRuntimeFromEnvironment({
    env,
    googleTransportFactory,
    recordTelemetry,
}: {
    env: Record<string, string | undefined> & GoogleCandidateQuestionWordingEnvironment;
    googleTransportFactory?: (apiKey: string) => GoogleCandidateQuestionWordingTransport;
    recordTelemetry?: (event: CandidateQuestionWordingRuntimeTelemetry) => void | Promise<void>;
}) {
    const provider = env[CANDIDATE_QUESTION_WORDING_PROVIDER_ENV]?.trim().toLowerCase();
    if (provider === GOOGLE_CANDIDATE_QUESTION_WORDING_PROVIDER) {
        try {
            const adapter = createGoogleCandidateQuestionWordingAdapterFromEnvironment({
                env,
                transportFactory: googleTransportFactory,
            });
            return adapter ? createCandidateQuestionWordingRuntime({ adapter, recordTelemetry }) : null;
        } catch (error) {
            if (error instanceof CandidateQuestionWordingRuntimeError && error.kind === "misconfigured") return null;
            throw error;
        }
    }

    if (!isExplicitLocalDevLaunchMode(env) || env.NODE_ENV === "production") return null;
    if (!provider || provider === "fixture") return createFixtureCandidateQuestionWordingRuntime();
    if (provider !== "fault") return null;
    const faultMode = readFaultMode(env[CANDIDATE_QUESTION_WORDING_FAULT_MODE_ENV]);
    return faultMode ? createFaultInjectionCandidateQuestionWordingRuntime(faultMode) : null;
}

function isExplicitLocalDevLaunchMode(env: Record<string, string | undefined>) {
    return env[CANDIDATE_HOST_LAUNCH_DEV_MODE_ENV] === "true"
        && Boolean(env[CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV]?.trim());
}

function readFaultMode(value: string | undefined): CandidateQuestionWordingFaultMode | null {
    const normalized = value?.trim().toLowerCase();
    return CANDIDATE_QUESTION_WORDING_FAULT_MODES.includes(normalized as CandidateQuestionWordingFaultMode)
        ? normalized as CandidateQuestionWordingFaultMode
        : null;
}
