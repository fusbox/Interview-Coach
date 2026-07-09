"use client";

import {
    AlertCircle,
    ArrowRight,
    BadgeCheck,
    Camera,
    FileText,
    Loader2,
    Upload,
    User,
    UserCheck,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, type MouseEvent, useEffect, useMemo, useState } from "react";

import {
    CANDIDATE_SETUP_LIMITS,
    candidateSetupStageOptions,
    safeParseCandidateSetupInput,
    toCandidateSetupTransition,
    type CandidateSetupStageId,
    type CandidateSetupTransition,
} from "./candidate-setup-contract";
import type { CandidateSetupSessionCreationResult } from "./candidate-setup-session-creation";
import { saveCandidateProvisionalSession } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import {
    clearCandidateSetupDraft,
    createCandidateSetupBrowserDraftStore,
    restoreCandidateSetupDraft,
    saveCandidateSetupDraft,
    toCandidateSetupDraftFormState,
    type CandidateSetupDraftStore,
} from "./candidate-setup-draft-store";

type ResumeSource = "paste" | "file" | "photo";

const questionCountOptions = [3, 5, 7, 10];

type CandidateSetupExperienceProps = {
    onSetupReady?: (transition: CandidateSetupTransition) => void;
    createSession?: (transition: CandidateSetupTransition) => Promise<CandidateSetupSessionCreationResult>;
    draftOwnerKey?: string;
    draftStore?: CandidateSetupDraftStore;
};

export function CandidateSetupExperience({
    onSetupReady,
    createSession,
    draftOwnerKey = "candidate:local",
    draftStore,
}: CandidateSetupExperienceProps = {}) {
    const [browserDraftStore, setBrowserDraftStore] = useState<CandidateSetupDraftStore | null>(null);
    const activeDraftStore = draftStore ?? browserDraftStore;
    const initialDraftState = useMemo(
        () => toCandidateSetupDraftFormState(draftStore ? restoreCandidateSetupDraft(draftStore, draftOwnerKey) : null),
        [draftOwnerKey, draftStore],
    );
    const [targetRole, setTargetRole] = useState(initialDraftState.targetRole);
    const [jobDescription, setJobDescription] = useState(initialDraftState.jobDescription);
    const [resumeText, setResumeText] = useState(initialDraftState.resumeText);
    const [selectedStage, setSelectedStage] = useState<CandidateSetupStageId>(initialDraftState.interviewStage);
    const [questionCount, setQuestionCount] = useState(initialDraftState.questionCount);
    const [resumeSource, setResumeSource] = useState<ResumeSource>("paste");
    const [resumeAssetName, setResumeAssetName] = useState("");
    const [isPreparing, setIsPreparing] = useState(false);
    const [setupError, setSetupError] = useState("");
    const [setupValidationMessage, setSetupValidationMessage] = useState("");
    const [setupValidationFields, setSetupValidationFields] = useState<Set<string>>(new Set());
    const [attemptedStart, setAttemptedStart] = useState(false);

    const activeStage = useMemo(
        () => candidateSetupStageOptions.find((stage) => stage.id === selectedStage) ?? candidateSetupStageOptions[2],
        [selectedStage],
    );
    const canStartPractice = targetRole.trim().length > 0 && jobDescription.trim().length > 0;
    const showRequiredAlert = attemptedStart && !canStartPractice;
    const isTargetRoleMissing = showRequiredAlert && targetRole.trim().length === 0;
    const isJobDescriptionMissing = showRequiredAlert && jobDescription.trim().length === 0;
    const isTargetRoleInvalid = isTargetRoleMissing || setupValidationFields.has("targetRole");
    const isJobDescriptionInvalid = isJobDescriptionMissing || setupValidationFields.has("jobDescription");

    useEffect(() => {
        if (draftStore || typeof window === "undefined") {
            return;
        }

        const nextDraftStore = createCandidateSetupBrowserDraftStore(window.localStorage);
        const nextDraftState = toCandidateSetupDraftFormState(restoreCandidateSetupDraft(nextDraftStore, draftOwnerKey));
        setBrowserDraftStore(nextDraftStore);
        setTargetRole(nextDraftState.targetRole);
        setJobDescription(nextDraftState.jobDescription);
        setResumeText(nextDraftState.resumeText);
        setSelectedStage(nextDraftState.interviewStage);
        setQuestionCount(nextDraftState.questionCount);
    }, [draftOwnerKey, draftStore]);

    function chooseStage(stage: (typeof candidateSetupStageOptions)[number]) {
        setSelectedStage(stage.id);
        setQuestionCount(stage.recommendedCount);
        saveSetupDraft({
            interviewStage: stage.id,
            questionCount: stage.recommendedCount,
        });
    }

    function handleResumeAsset(event: ChangeEvent<HTMLInputElement>, source: ResumeSource) {
        const file = event.target.files?.[0];
        setResumeSource(source);
        setResumeAssetName(file?.name ?? "");
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canStartPractice) {
            setAttemptedStart(true);
            setSetupValidationMessage("");
            setSetupValidationFields(new Set());
            return;
        }
        const setupInput = {
            targetRole,
            jobDescription,
            resumeText,
            interviewStage: selectedStage,
            questionCount,
        };
        const parsedSetup = safeParseCandidateSetupInput(setupInput);
        if (!parsedSetup.success) {
            const fieldErrors = parsedSetup.error.flatten().fieldErrors;
            setAttemptedStart(true);
            setSetupError("");
            setSetupValidationFields(new Set(Object.keys(fieldErrors)));
            setSetupValidationMessage(toSetupValidationMessage(fieldErrors));
            return;
        }

        const payload = parsedSetup.data;
        const transition = toCandidateSetupTransition(payload);
        onSetupReady?.(transition);
        setIsPreparing(true);
        setSetupError("");
        setSetupValidationMessage("");
        setSetupValidationFields(new Set());

        if (!createSession && onSetupReady) {
            return;
        }

        try {
            const result = await (createSession ?? createSessionViaSetupRoute)(transition);
            saveCandidateProvisionalSession(window.sessionStorage, result);
            if (activeDraftStore) {
                clearCandidateSetupDraft(activeDraftStore, draftOwnerKey);
            }
            window.location.assign(result.nextRoute);
        } catch {
            setIsPreparing(false);
            setSetupError("I could not start this practice round. Try again.");
        }
    }

    function handleStartPracticeClick(event: MouseEvent<HTMLButtonElement>) {
        if (!canStartPractice) {
            event.preventDefault();
            setAttemptedStart(true);
            setSetupValidationMessage("");
            setSetupValidationFields(new Set());
        }
    }

    function clearSetupValidation() {
        if (!setupValidationMessage && setupValidationFields.size === 0) {
            return;
        }

        setSetupValidationMessage("");
        setSetupValidationFields(new Set());
    }

    function saveSetupDraft(overrides: Partial<{
        targetRole: string;
        jobDescription: string;
        resumeText: string;
        interviewStage: CandidateSetupStageId;
        questionCount: number;
    }> = {}) {
        const nextTargetRole = overrides.targetRole ?? targetRole;
        const nextJobDescription = overrides.jobDescription ?? jobDescription;

        const nextInput = {
            targetRole: nextTargetRole,
            jobDescription: nextJobDescription,
            resumeText: overrides.resumeText ?? resumeText,
            interviewStage: overrides.interviewStage ?? selectedStage,
            questionCount: overrides.questionCount ?? questionCount,
        };

        if (
            !activeDraftStore
            || !nextTargetRole.trim()
            || !nextJobDescription.trim()
            || !safeParseCandidateSetupInput(nextInput).success
        ) {
            return;
        }

        saveCandidateSetupDraft(activeDraftStore, draftOwnerKey, nextInput);
    }

    return (
        <main className="candidate-design-system setup-page">
            <section className="setup-hero app-grid">
                <div className="setup-hero__copy">
                    <h1 className="setup-page-title">Practice Setup</h1>
                </div>

                <aside className="setup-progress-card" aria-label="Setup progress">
                    <div className="setup-progress-card__icon" aria-hidden="true">
                        <User size={20} />
                    </div>
                    <div>
                        <p>
                            Tell me what interview you are preparing for. After setup, I will prepare your first round and
                            guide what to practice after you finish it.
                        </p>
                    </div>
                </aside>
            </section>

            <form className="setup-form app-grid" onSubmit={handleSubmit}>
                <div className="setup-form__main">
                    <section className="setup-panel" aria-labelledby="role-context-label">
                        <div className="setup-section-header">
                            <div>
                                <p className="type-eyebrow" id="role-context-label">
                                    Role
                                </p>
                            </div>
                        </div>

                        <div className="setup-field-grid">
                            <label className="setup-field setup-field--full">
                                <span>Target role *</span>
                                <input
                                    name="targetRole"
                                    required
                                    maxLength={CANDIDATE_SETUP_LIMITS.targetRole + 1}
                                    aria-invalid={isTargetRoleInvalid}
                                    className={isTargetRoleInvalid ? "is-required-missing" : undefined}
                                    value={targetRole}
                                    onChange={(event) => {
                                        clearSetupValidation();
                                        setTargetRole(event.target.value);
                                        saveSetupDraft({ targetRole: event.target.value });
                                    }}
                                    placeholder="Example: Customer service representative"
                                />
                            </label>

                            <label className="setup-field setup-field--full">
                                <span>Job description *</span>
                                <textarea
                                    name="jobDescription"
                                    required
                                    maxLength={CANDIDATE_SETUP_LIMITS.jobDescription + 1}
                                    aria-invalid={isJobDescriptionInvalid}
                                    className={isJobDescriptionInvalid ? "is-required-missing" : undefined}
                                    value={jobDescription}
                                    onChange={(event) => {
                                        clearSetupValidation();
                                        setJobDescription(event.target.value);
                                        saveSetupDraft({ jobDescription: event.target.value });
                                    }}
                                    rows={7}
                                    placeholder="Paste the job description or the parts that explain the role, duties, and requirements."
                                />
                            </label>
                        </div>
                    </section>

                    <section className="setup-panel" aria-labelledby="resume-context-label">
                        <div className="setup-section-header">
                            <div>
                                <p className="type-eyebrow" id="resume-context-label">
                                    Resume
                                    <span className="setup-eyebrow-note">Optional</span>
                                </p>
                            </div>
                        </div>

                        <div className="resume-source-grid" role="group" aria-label="Resume input method">
                            <button
                                type="button"
                                className={resumeSource === "paste" ? "resume-source is-selected" : "resume-source"}
                                aria-pressed={resumeSource === "paste"}
                                onClick={() => setResumeSource("paste")}
                            >
                                <FileText size={18} aria-hidden="true" />
                                <span>Paste text</span>
                            </button>

                            <label className={resumeSource === "file" ? "resume-source is-selected" : "resume-source"}>
                                <Upload size={18} aria-hidden="true" />
                                <span>Upload file</span>
                                <input
                                    type="file"
                                    name="resumeFile"
                                    accept=".pdf,.doc,.docx,.txt,image/*"
                                    onChange={(event) => handleResumeAsset(event, "file")}
                                />
                            </label>

                            <label className={resumeSource === "photo" ? "resume-source is-selected" : "resume-source"}>
                                <Camera size={18} aria-hidden="true" />
                                <span>Take photo</span>
                                <input
                                    type="file"
                                    name="resumePhoto"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(event) => handleResumeAsset(event, "photo")}
                                />
                            </label>
                        </div>

                        {resumeAssetName ? (
                            <p className="resume-asset-note" aria-live="polite">
                                Selected: {resumeAssetName}. After extraction, review the text before starting.
                            </p>
                        ) : null}

                        <label className="setup-field setup-field--full">
                            <span>Paste resume text</span>
                            <textarea
                                name="resumeText"
                                maxLength={CANDIDATE_SETUP_LIMITS.resumeText + 1}
                                value={resumeText}
                                onChange={(event) => {
                                    clearSetupValidation();
                                    setResumeText(event.target.value);
                                    saveSetupDraft({ resumeText: event.target.value });
                                }}
                                rows={6}
                                placeholder="Paste resume text here."
                            />
                        </label>
                    </section>

                    <section className="setup-panel" aria-labelledby="practice-details-label">
                        <div className="setup-section-header">
                            <div>
                                <p className="type-eyebrow" id="practice-details-label">
                                    Interview details
                                </p>
                            </div>
                        </div>

                        <fieldset className="setup-fieldset">
                            <legend>Interview stage *</legend>
                            <div className="stage-grid">
                                {candidateSetupStageOptions.map((stage) => (
                                    <button
                                        key={stage.id}
                                        type="button"
                                        className={selectedStage === stage.id ? "stage-card is-selected" : "stage-card"}
                                        aria-pressed={selectedStage === stage.id}
                                        onClick={() => chooseStage(stage)}
                                    >
                                        <strong>{stage.label}</strong>
                                        <span>{stage.detail}</span>
                                    </button>
                                ))}
                            </div>
                            <input type="hidden" name="interviewStage" value={selectedStage} required />
                        </fieldset>

                        <fieldset className="setup-fieldset">
                            <legend>Question count *</legend>
                            <div className="question-count-row">
                                {questionCountOptions.map((count) => (
                                    <button
                                        key={count}
                                        type="button"
                                        className={questionCount === count ? "count-option is-selected" : "count-option"}
                                        aria-pressed={questionCount === count}
                                        onClick={() => {
                                            setQuestionCount(count);
                                            saveSetupDraft({ questionCount: count });
                                        }}
                                    >
                                        {count}
                                    </button>
                                ))}
                            </div>
                            <input type="hidden" name="questionCount" value={questionCount} required />
                            <p className="question-help">
                                {activeStage.recommendation} You can choose a different count, and after your first
                                session I will guide what to practice next.
                            </p>
                        </fieldset>
                    </section>
                </div>

                <aside className="setup-rail" aria-label="Setup summary">
                    <div className={canStartPractice ? "setup-rail__card is-ready" : "setup-rail__card"}>
                        <div className="setup-rail__header">
                            <span className="setup-rail__icon" aria-hidden="true">
                                {canStartPractice ? <BadgeCheck size={18} /> : <UserCheck size={18} />}
                            </span>
                            <p className="type-eyebrow">{canStartPractice ? "Ready when you are" : "Your first round"}</p>
                        </div>
                        <dl>
                            <div>
                                <dt>Stage</dt>
                                <dd>{activeStage.label}</dd>
                            </div>
                            <div>
                                <dt>Recommended</dt>
                                <dd>{activeStage.recommendedCount} questions</dd>
                            </div>
                            <div>
                                <dt>Selected</dt>
                                <dd>{questionCount} questions</dd>
                            </div>
                        </dl>
                    </div>

                    <div
                        className={
                            isPreparing
                                ? "setup-loading-card is-active"
                                : setupError
                                  ? "setup-loading-card is-alert"
                                : setupValidationMessage
                                  ? "setup-loading-card is-alert"
                                : showRequiredAlert
                                  ? "setup-loading-card is-alert"
                                  : "setup-loading-card"
                        }
                        aria-live="polite"
                        role={showRequiredAlert || setupError || setupValidationMessage ? "alert" : undefined}
                    >
                        {isPreparing ? (
                            <>
                                <Loader2 className="setup-spinner" size={18} aria-hidden="true" />
                                <div>
                                    <strong>Building your practice plan.</strong>
                                    <span>Preparing the transition into your first session.</span>
                                </div>
                            </>
                        ) : setupError ? (
                            <>
                                <span className="setup-loading-card__icon" aria-hidden="true">
                                    <AlertCircle size={18} />
                                </span>
                                <div>
                                    <span>{setupError}</span>
                                </div>
                            </>
                        ) : setupValidationMessage ? (
                            <>
                                <span className="setup-loading-card__icon" aria-hidden="true">
                                    <AlertCircle size={18} />
                                </span>
                                <div>
                                    <span>{setupValidationMessage}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                {showRequiredAlert ? (
                                    <span className="setup-loading-card__icon" aria-hidden="true">
                                        <AlertCircle size={18} />
                                    </span>
                                ) : null}
                                <div>
                                    <span>Required fields are marked with an asterisk.</span>
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        className="setup-submit"
                        type="submit"
                        disabled={isPreparing}
                        aria-disabled={!canStartPractice}
                        onClick={handleStartPracticeClick}
                    >
                        {isPreparing ? "Preparing" : "Start practice"}
                        {isPreparing ? <Loader2 className="setup-spinner" size={16} aria-hidden="true" /> : <ArrowRight size={16} />}
                    </button>
                </aside>
            </form>
        </main>
    );
}

function toSetupValidationMessage(fieldErrors: {
    targetRole?: string[];
    jobDescription?: string[];
    resumeText?: string[];
    questionCount?: string[];
}) {
    return [
        ...(fieldErrors.targetRole ?? []),
        ...(fieldErrors.jobDescription ?? []),
        ...(fieldErrors.resumeText ?? []),
        ...(fieldErrors.questionCount ?? []),
    ][0] ?? "Check the setup details and try again.";
}

async function createSessionViaSetupRoute(transition: CandidateSetupTransition) {
    const response = await fetch("/candidate/setup/start", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(transition.payload),
    });

    if (!response.ok) {
        throw new Error("Candidate setup session creation failed.");
    }

    return await response.json() as CandidateSetupSessionCreationResult;
}
