export {
    createStaticCandidateAuthAdapter,
    toCandidateProfileResolutionInput,
    type CandidateAuthAdapter,
    type CandidateAuthAdapterSource,
    type CandidateAuthHandoff,
} from "./candidate-auth-adapter";
export {
    resolveLocalCandidateAuthHandoff,
} from "./candidate-dev-auth-resolver";
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
    createCandidatePracticeDraft,
    findCandidatePracticeDraftById,
    findCandidatePracticeDraftBySessionId,
    findLatestEditableCandidatePracticeDraft,
    transitionCandidatePracticeDraftToGenerating,
    updateCandidatePracticeDraftProgressBySessionId,
    updateCandidatePracticeDraftSetup,
    type CandidatePracticeDraft,
    type CandidatePracticeDraftLookup,
    type CandidatePracticeDraftSessionLookup,
    type CreateCandidatePracticeDraftInput,
    type PracticeResumeTarget,
    type PracticeSessionDraftStatus,
    type ResumeContextSnapshot,
    type UpdateCandidatePracticeDraftSetupInput,
} from "./candidate-practice-draft-repository";
export {
    loadPracticeSetupDraftForCurrentCandidate,
    type RestoredPracticeSetupDraft,
} from "./candidate-practice-setup-loader";
export {
    loadCandidateSessionForCurrentCandidate,
    type LoadedCandidateSession,
} from "./candidate-session-loader";
export {
    advanceCandidateOwnedSession,
    pauseCandidateOwnedSession,
    resumeCandidateOwnedSession,
    startCandidateOwnedSession,
} from "./candidate-session-progress-service";
export {
    getCandidateAuthMode,
    getCandidateDataBackend,
    getCandidateRuntimeConfig,
    type CandidateAuthMode,
    type CandidateDataBackend,
    type CandidateRuntimeConfig,
} from "./candidate-runtime-config";
