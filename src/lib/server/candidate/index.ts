export {
    createStaticCandidateAuthAdapter,
    toCandidateProfileResolutionInput,
    type CandidateAuthAdapter,
    type CandidateAuthAdapterSource,
    type CandidateAuthHandoff,
} from "./candidate-auth-adapter";
export {
    buildCandidateAuthSubject,
    findCandidateProfileByIdentity,
    resolveCandidateProfileFromIdentity,
    type CandidateIdentityLookup,
    type CandidateIdentityProvider,
    type CandidateProfileAccessRecord,
    type CandidateWorkspace,
    type ResolveCandidateProfileInput,
} from "./candidate-profile-repository";
export {
    getCandidateAuthMode,
    getCandidateDataBackend,
    getCandidateRuntimeConfig,
    type CandidateAuthMode,
    type CandidateDataBackend,
    type CandidateRuntimeConfig,
} from "./candidate-runtime-config";
