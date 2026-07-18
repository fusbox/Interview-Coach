import {
    GOOGLE_CANDIDATE_COACH_UPDATE_PROVIDER,
    createGoogleCandidateCoachUpdateAdapterFromEnvironment,
    type GoogleCandidateCoachUpdateEnvironment,
    type GoogleCandidateCoachUpdateTransport,
} from "./google-candidate-coach-update";
import {
    CANDIDATE_COACH_UPDATE_FAULT_MODE_ENV,
    CANDIDATE_COACH_UPDATE_FAULT_MODES,
    CANDIDATE_COACH_UPDATE_PROVIDER_ENV,
    createCandidateCoachUpdateSynthesisRuntime,
    createFaultInjectionCandidateCoachUpdateRuntime,
    createFixtureCandidateCoachUpdateRuntime,
    CandidateCoachUpdateRuntimeError,
    type CandidateCoachUpdateFaultMode,
    type CandidateCoachUpdateRuntimeTelemetry,
    type CandidateCoachUpdateSynthesisRuntime,
} from "./candidate-coach-update-runtime";

export function createCandidateCoachUpdateRuntimeFromEnvironment({
    env,
    explicitLocalDev,
    googleTransportFactory,
    recordTelemetry,
}: {
    env: Record<string, string | undefined> & GoogleCandidateCoachUpdateEnvironment;
    explicitLocalDev: boolean;
    googleTransportFactory?: (apiKey: string) => GoogleCandidateCoachUpdateTransport;
    recordTelemetry?: (event: CandidateCoachUpdateRuntimeTelemetry) => void | Promise<void>;
}): CandidateCoachUpdateSynthesisRuntime | null {
    const configuredProvider = env[CANDIDATE_COACH_UPDATE_PROVIDER_ENV]?.trim().toLowerCase();
    if (configuredProvider === GOOGLE_CANDIDATE_COACH_UPDATE_PROVIDER) {
        try {
            const adapter = createGoogleCandidateCoachUpdateAdapterFromEnvironment({
                env,
                transportFactory: googleTransportFactory,
            });
            return adapter ? createCandidateCoachUpdateSynthesisRuntime({ adapter, recordTelemetry }) : null;
        } catch (error) {
            if (error instanceof CandidateCoachUpdateRuntimeError && error.kind === "misconfigured") {
                return null;
            }
            throw error;
        }
    }

    if (!explicitLocalDev || env.NODE_ENV === "production") return null;

    const provider = configuredProvider || "fixture";
    if (provider === "fixture") return createFixtureCandidateCoachUpdateRuntime();
    if (provider !== "fault") return null;

    const faultMode = readFaultMode(env[CANDIDATE_COACH_UPDATE_FAULT_MODE_ENV]);
    return faultMode ? createFaultInjectionCandidateCoachUpdateRuntime(faultMode) : null;
}

function readFaultMode(value: string | undefined): CandidateCoachUpdateFaultMode | null {
    const normalized = value?.trim().toLowerCase();
    return CANDIDATE_COACH_UPDATE_FAULT_MODES.includes(normalized as CandidateCoachUpdateFaultMode)
        ? normalized as CandidateCoachUpdateFaultMode
        : null;
}
