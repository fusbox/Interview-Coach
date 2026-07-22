"use client";

import {
    AlertCircle,
    ArrowDown,
    ArrowRight,
    ArrowUp,
    BadgeCheck,
    Camera,
    ChevronDown,
    FileText,
    Loader2,
    Trash2,
    Upload,
    User,
    UserCheck,
    X,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";

import {
    CANDIDATE_SETUP_LIMITS,
    candidateSetupStageOptions,
    safeParseCandidateSetupInput,
    toCandidateSetupTransition,
    type CandidateSetupStageId,
    type CandidateSetupTransition,
    type CandidateSetupResumeArtifactReference,
} from "./candidate-setup-contract";
import type { CandidateSetupSessionCreationResult } from "./candidate-setup-session-creation";
import type { CandidateExistingPrepContextSummary } from "./candidate-setup-prep-context-repository";
import type { CandidateTrustedSetupContext } from "./candidate-setup-entry-context";
import { saveCandidateProvisionalSession } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import {
    clearCandidateSetupDraft,
    createCandidateSetupBrowserDraftStore,
    getOrCreateCandidateSetupStartRequest,
    restoreCandidateSetupDraft,
    saveCandidateSetupDraft,
    toCandidateSetupDraftFormState,
    type CandidateSetupDraftStore,
} from "./candidate-setup-draft-store";

type ResumeSource = "paste" | "file" | "photo";

type SetupHydrationField = "targetRole" | "jobDescription" | "resume" | "interviewDetails";

type ResumePhotoPage = {
    id: string;
    file: File;
};

export type CandidateResumeReviewArtifact = CandidateSetupResumeArtifactReference & {
    normalizedText: string;
    piiRedactionCounts: Record<string, number>;
    createdAt: string;
    acceptedAt: string | null;
};

const CANDIDATE_RESUME_DOCUMENT_ACCEPT = [
    ".pdf",
    ".docx",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

const questionCountOptions = [3, 5, 7, 10];

type CandidateSetupExperienceProps = {
    onSetupReady?: (transition: CandidateSetupTransition) => void;
    createSession?: (
        transition: CandidateSetupTransition,
        decision?: CandidateSetupPrepContextDecision,
    ) => Promise<CandidateSetupStartResult>;
    draftOwnerKey?: string;
    draftStore?: CandidateSetupDraftStore;
    trustedSetupContext?: CandidateTrustedSetupContext | null;
    initialResumeArtifact?: CandidateResumeReviewArtifact | null;
};

type CandidateSetupPrepContextDecision = {
    action: "create_separate_path" | "use_existing_path";
    matchingRoleProfileId: string;
};

type CandidateSetupStartResult = CandidateSetupSessionCreationResult | {
    status: "existing_prep_context_found";
    existingPrepContexts: CandidateExistingPrepContextSummary[];
} | {
    status: "existing_prep_context_selected";
    nextRoute: string;
};

class CandidateSetupStartRequestError extends Error {
    readonly candidateMessage: string;
    readonly code: string | null;

    constructor(candidateMessage: string, code: string | null = null) {
        super("Candidate setup session creation failed.");
        this.name = "CandidateSetupStartRequestError";
        this.candidateMessage = candidateMessage;
        this.code = code;
    }
}

class CandidateResumeReviewRequestError extends Error {
    readonly candidateMessage: string;
    readonly code: string | null;

    constructor(candidateMessage: string, code: string | null = null) {
        super("Candidate resume review request failed.");
        this.name = "CandidateResumeReviewRequestError";
        this.candidateMessage = candidateMessage;
        this.code = code;
    }
}

export function CandidateSetupExperience({
    onSetupReady,
    createSession,
    draftOwnerKey = "candidate:local",
    draftStore,
    trustedSetupContext = null,
    initialResumeArtifact = null,
}: CandidateSetupExperienceProps = {}) {
    const [browserDraftStore, setBrowserDraftStore] = useState<CandidateSetupDraftStore | null>(null);
    const activeDraftStore = draftStore ?? browserDraftStore;
    const initialDraftState = useMemo(
        () => toCandidateSetupDraftFormState(draftStore ? restoreCandidateSetupDraft(draftStore, draftOwnerKey) : null),
        [draftOwnerKey, draftStore],
    );
    const [targetRole, setTargetRole] = useState(trustedSetupContext?.targetRole ?? initialDraftState.targetRole);
    const [jobDescription, setJobDescription] = useState(
        trustedSetupContext?.jobDescription ?? initialDraftState.jobDescription,
    );
    const initialResumeState = initialResumeArtifact ?? (initialDraftState.resumeArtifact
        ? {
            ...initialDraftState.resumeArtifact,
            normalizedText: initialDraftState.resumeText,
            piiRedactionCounts: {},
            createdAt: "",
            acceptedAt: initialDraftState.resumeArtifact.reviewState === "accepted" ? "restored" : null,
        }
        : null);
    const [resumeText, setResumeText] = useState(initialResumeState?.normalizedText ?? initialDraftState.resumeText);
    const [resumeArtifact, setResumeArtifact] = useState<CandidateResumeReviewArtifact | null>(
        initialResumeState,
    );
    const [selectedStage, setSelectedStage] = useState<CandidateSetupStageId>(initialDraftState.interviewStage);
    const [questionCount, setQuestionCount] = useState(initialDraftState.questionCount);
    const [resumeSource, setResumeSource] = useState<ResumeSource>(
        toResumeUiSource(initialResumeState?.source),
    );
    const [resumeAssetName, setResumeAssetName] = useState(
        initialResumeState?.source === "document_upload"
            || initialResumeState?.source === "photo_capture"
            ? initialResumeState.candidateLabel
            : "",
    );
    const [resumePhotoPages, setResumePhotoPages] = useState<ResumePhotoPage[]>([]);
    const [isResumeProcessing, setIsResumeProcessing] = useState(false);
    const [resumeReviewMessage, setResumeReviewMessage] = useState("");
    const [resumeError, setResumeError] = useState("");
    const [isPreparing, setIsPreparing] = useState(false);
    const [setupError, setSetupError] = useState("");
    const [setupValidationMessage, setSetupValidationMessage] = useState("");
    const [setupValidationFields, setSetupValidationFields] = useState<Set<string>>(new Set());
    const [attemptedStart, setAttemptedStart] = useState(false);
    const [existingPrepContexts, setExistingPrepContexts] = useState<CandidateExistingPrepContextSummary[]>([]);
    const [selectedExistingRoleProfileId, setSelectedExistingRoleProfileId] = useState("");
    const [pendingSetupTransition, setPendingSetupTransition] = useState<CandidateSetupTransition | null>(null);
    const [existingContextError, setExistingContextError] = useState("");
    const existingContextDialogRef = useRef<HTMLDialogElement | null>(null);
    const setupStartRequestRef = useRef<{ requestSignature: string; idempotencyKey: string } | null>(null);
    const resumeSelectionClearRef = useRef<Promise<void>>(Promise.resolve());
    const userEditedSetupFieldsRef = useRef<Set<SetupHydrationField>>(new Set());

    const activeStage = useMemo(
        () => candidateSetupStageOptions.find((stage) => stage.id === selectedStage) ?? candidateSetupStageOptions[2],
        [selectedStage],
    );
    const resumeNeedsReview = isResumeProcessing
        || (resumeText.trim().length > 0 && resumeArtifact?.reviewState !== "accepted")
        || (resumeSource !== "paste" && Boolean(resumeAssetName) && resumeArtifact?.reviewState !== "accepted");
    const canStartPractice = targetRole.trim().length > 0
        && jobDescription.trim().length > 0
        && !resumeNeedsReview;
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
        if (!userEditedSetupFieldsRef.current.has("targetRole")) {
            setTargetRole(trustedSetupContext?.targetRole ?? nextDraftState.targetRole);
        }
        if (!userEditedSetupFieldsRef.current.has("jobDescription")) {
            setJobDescription(trustedSetupContext?.jobDescription ?? nextDraftState.jobDescription);
        }
        const recoveredResume = initialResumeArtifact ?? (nextDraftState.resumeArtifact
            ? {
                ...nextDraftState.resumeArtifact,
                normalizedText: nextDraftState.resumeText,
                piiRedactionCounts: {},
                createdAt: "",
                acceptedAt: nextDraftState.resumeArtifact.reviewState === "accepted" ? "restored" : null,
            }
            : null);
        if (!userEditedSetupFieldsRef.current.has("resume")) {
            setResumeText(recoveredResume?.normalizedText ?? nextDraftState.resumeText);
            setResumeArtifact(recoveredResume);
            setResumeSource(toResumeUiSource(recoveredResume?.source));
            setResumeAssetName(recoveredResume?.source === "document_upload"
                || recoveredResume?.source === "photo_capture"
                ? recoveredResume.candidateLabel
                : "");
        }
        if (!userEditedSetupFieldsRef.current.has("interviewDetails")) {
            setSelectedStage(nextDraftState.interviewStage);
            setQuestionCount(nextDraftState.questionCount);
        }
    }, [draftOwnerKey, draftStore, initialResumeArtifact, trustedSetupContext]);

    useEffect(() => {
        const dialog = existingContextDialogRef.current;
        if (!dialog) {
            return;
        }

        if (existingPrepContexts.length > 0 && !dialog.open) {
            try {
                dialog.showModal();
            } catch {
                dialog.setAttribute("open", "");
            }
        } else if (existingPrepContexts.length === 0 && dialog.open) {
            dialog.close();
        }
    }, [existingPrepContexts]);

    function chooseStage(stage: (typeof candidateSetupStageOptions)[number]) {
        userEditedSetupFieldsRef.current.add("interviewDetails");
        setSelectedStage(stage.id);
        setQuestionCount(stage.recommendedCount);
        saveSetupDraft({
            interviewStage: stage.id,
            questionCount: stage.recommendedCount,
        });
    }

    async function handleResumeAsset(event: ChangeEvent<HTMLInputElement>, source: ResumeSource) {
        userEditedSetupFieldsRef.current.add("resume");
        const selectedFiles = Array.from(event.target.files ?? []);
        const file = selectedFiles[0];
        event.target.value = "";

        if (
            resumeArtifact
            || resumeText.trim()
            || (resumeAssetName && (source !== "photo" || resumeSource !== "photo"))
        ) {
            try {
                await invalidateResumeSelection();
            } catch {
                return;
            }
        }

        if (source === "photo") {
            queueResumePhotos(selectedFiles);
            return;
        }

        setResumeSource(source);
        setResumePhotoPages([]);
        setResumeAssetName(file?.name ?? "");
        setResumeText("");
        setResumeArtifact(null);
        setResumeReviewMessage("");
        setResumeError("");
        saveSetupDraft({ resumeText: "", resumeArtifact: null });

        if (!file || source !== "file") {
            return;
        }

        const mimeType = resolveResumeDocumentMimeType(file);
        if (!mimeType) {
            setResumeError("Choose a PDF or DOCX resume.");
            return;
        }

        setIsResumeProcessing(true);
        setResumeReviewMessage("Preparing the document for your review.");
        try {
            const operationId = createResumeSelectionOperationId();
            const response = await fetch("/candidate/setup/resume-document", {
                method: "POST",
                headers: {
                    "Content-Type": mimeType,
                    "X-Resume-Document-Name": encodeURIComponent(file.name),
                    "X-Candidate-Resume-Selection-Operation": operationId,
                },
                body: file,
            });
            const result = await readCandidateResumeArtifactResponse(response);
            setResumeText(result.artifact.normalizedText);
            setResumeArtifact(result.artifact);
            setResumeAssetName(result.artifact.candidateLabel);
            if (result.artifact.reviewState === "accepted") {
                setResumeReviewMessage("This accepted resume is ready to use.");
                saveSetupDraft({
                    resumeText: result.artifact.normalizedText,
                    resumeArtifact: toResumeArtifactReference(result.artifact),
                });
            } else {
                setResumeReviewMessage("Review the prepared text, make any corrections, then confirm it for practice.");
                saveSetupDraft({
                    resumeText: "",
                    resumeArtifact: toResumeArtifactReference(result.artifact),
                });
            }
        } catch (error) {
            setResumeError(error instanceof CandidateResumeReviewRequestError
                ? error.candidateMessage
                : "I could not prepare that document. Try another file or paste the resume text.");
            setResumeReviewMessage("");
        } finally {
            setIsResumeProcessing(false);
        }
    }

    function queueResumePhotos(files: File[]) {
        if (files.length === 0) return;
        setResumeSource("photo");
        setResumeText("");
        setResumeArtifact(null);
        setResumeReviewMessage("");
        setResumeError("");
        saveSetupDraft({ resumeText: "", resumeArtifact: null });
        const remaining = Math.max(0, 4 - resumePhotoPages.length);
        const additions = files.slice(0, remaining).map((file) => ({
            id: createResumePhotoPageId(),
            file,
        }));
        const next = [...resumePhotoPages, ...additions];
        setResumePhotoPages(next);
        setResumeAssetName(`${next.length} resume photo${next.length === 1 ? "" : "s"}`);
        if (files.length > remaining) {
            setResumeError("You can add up to 4 resume pages.");
        }
    }

    function removeResumePhotoPage(pageId: string) {
        const next = resumePhotoPages.filter((page) => page.id !== pageId);
        setResumePhotoPages(next);
        setResumeAssetName(next.length ? `${next.length} resume photo${next.length === 1 ? "" : "s"}` : "");
        setResumeError("");
    }

    function moveResumePhotoPage(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= resumePhotoPages.length) return;
        const next = [...resumePhotoPages];
        [next[index], next[target]] = [next[target]!, next[index]!];
        setResumePhotoPages(next);
    }

    async function processResumePhotos() {
        if (resumePhotoPages.length === 0 || isResumeProcessing) return;
        setIsResumeProcessing(true);
        setResumeError("");
        setResumeReviewMessage("Reading the pages in the order shown.");
        const formData = new FormData();
        for (const page of resumePhotoPages) {
            formData.append("pages", page.file, page.file.name || "resume-photo");
        }

        try {
            await resumeSelectionClearRef.current;
            const operationId = createResumeSelectionOperationId();
            const response = await fetch("/candidate/setup/resume-photo", {
                method: "POST",
                headers: { "X-Candidate-Resume-Selection-Operation": operationId },
                body: formData,
            });
            const result = await readCandidateResumeArtifactResponse(response);
            setResumeText(result.artifact.normalizedText);
            setResumeArtifact(result.artifact);
            setResumeAssetName(result.artifact.candidateLabel);
            if (result.artifact.reviewState === "accepted") {
                setResumeReviewMessage("This accepted resume is ready to use.");
                saveSetupDraft({
                    resumeText: result.artifact.normalizedText,
                    resumeArtifact: toResumeArtifactReference(result.artifact),
                });
            } else {
                setResumeReviewMessage("Review the prepared text, make any corrections, then confirm it for practice.");
                saveSetupDraft({
                    resumeText: "",
                    resumeArtifact: toResumeArtifactReference(result.artifact),
                });
            }
        } catch (error) {
            setResumeAssetName("");
            setResumeReviewMessage("");
            setResumeError(error instanceof CandidateResumeReviewRequestError
                ? error.candidateMessage
                : "I could not read those photos. Retake them, choose existing photos, or paste the resume text.");
        } finally {
            setResumePhotoPages([]);
            setIsResumeProcessing(false);
        }
    }

    async function processPastedResume() {
        if (!resumeText.trim() || isResumeProcessing) {
            return;
        }
        setIsResumeProcessing(true);
        setResumeError("");
        setResumeReviewMessage("");
        try {
            await resumeSelectionClearRef.current;
            const operationId = createResumeSelectionOperationId();
            const response = await fetch("/candidate/setup/resume-text", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Candidate-Resume-Selection-Operation": operationId,
                },
                body: JSON.stringify({ source: "pasted_text", text: resumeText }),
            });
            const result = await readCandidateResumeArtifactResponse(response);
            setResumeText(result.artifact.normalizedText);
            setResumeArtifact(result.artifact);
            if (result.artifact.reviewState === "accepted") {
                setResumeReviewMessage("This accepted resume is ready to use.");
                saveSetupDraft({
                    resumeText: result.artifact.normalizedText,
                    resumeArtifact: toResumeArtifactReference(result.artifact),
                });
            } else {
                setResumeReviewMessage("Review the prepared text, make any corrections, then confirm it for practice.");
                saveSetupDraft({
                    resumeText: "",
                    resumeArtifact: toResumeArtifactReference(result.artifact),
                });
            }
        } catch (error) {
            setResumeError(error instanceof CandidateResumeReviewRequestError
                ? error.candidateMessage
                : "I could not prepare that resume text. Try again.");
        } finally {
            setIsResumeProcessing(false);
        }
    }

    async function acceptProcessedResume() {
        if (!resumeArtifact || resumeArtifact.reviewState !== "awaiting_review" || isResumeProcessing) {
            return;
        }
        setIsResumeProcessing(true);
        setResumeError("");
        setResumeReviewMessage("");
        try {
            const response = await fetch(
                `/candidate/setup/resume-text/${encodeURIComponent(resumeArtifact.artifactId)}/accept`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        version: resumeArtifact.version,
                        revision: resumeArtifact.revision,
                        reviewedText: resumeText,
                    }),
                },
            );
            const result = await readCandidateResumeArtifactResponse(response);
            setResumeText(result.artifact.normalizedText);
            setResumeArtifact(result.artifact);
            if (result.outcome === "review_required") {
                setResumeReviewMessage("I removed additional personal details. Review the updated text, then confirm it again.");
                saveSetupDraft({
                    resumeText: "",
                    resumeArtifact: toResumeArtifactReference(result.artifact),
                });
            } else {
                setResumeReviewMessage("Resume ready. I will use this reviewed text to tailor your practice.");
                saveSetupDraft({
                    resumeText: result.artifact.normalizedText,
                    resumeArtifact: toResumeArtifactReference(result.artifact),
                });
            }
        } catch (error) {
            if (
                error instanceof CandidateResumeReviewRequestError
                && error.code === "RESUME_REVIEW_POLICY_CHANGED"
            ) {
                setResumeArtifact(null);
                setResumeReviewMessage("Review this text again with the updated privacy protections.");
                saveSetupDraft({ resumeText: "", resumeArtifact: null });
            }
            setResumeError(error instanceof CandidateResumeReviewRequestError
                ? error.candidateMessage
                : "I could not save this resume review. Try again.");
        } finally {
            setIsResumeProcessing(false);
        }
    }

    function invalidateResumeSelection() {
        const clearRequest = fetch("/candidate/setup/resume-text/selection", { method: "DELETE" })
            .then((response) => {
                if (!response.ok) {
                    throw new CandidateResumeReviewRequestError("I could not clear that resume selection. Try again.");
                }
            })
            .catch((error) => {
                setResumeError(error instanceof CandidateResumeReviewRequestError
                    ? error.candidateMessage
                    : "I could not clear that resume selection. Try again.");
                throw error;
            });
        resumeSelectionClearRef.current = clearRequest;
        return clearRequest;
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
            resumeArtifact: resumeArtifact ? toResumeArtifactReference(resumeArtifact) : null,
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
        setExistingContextError("");
        setSetupValidationMessage("");
        setSetupValidationFields(new Set());

        if (!createSession && onSetupReady) {
            return;
        }

        await performSetupStart(transition);
    }

    async function performSetupStart(
        transition: CandidateSetupTransition,
        decision?: CandidateSetupPrepContextDecision,
    ) {
        setIsPreparing(true);
        setSetupError("");

        try {
            let result: CandidateSetupStartResult;
            if (createSession) {
                result = decision
                    ? await createSession(transition, decision)
                    : await createSession(transition);
            } else {
                const setupEntryMode = trustedSetupContext ? "trusted_host_job" : null;
                const requestSignature = await createSetupStartRequestSignature(
                    transition,
                    decision,
                    setupEntryMode,
                );
                if (activeDraftStore) {
                    saveCandidateSetupDraft(activeDraftStore, draftOwnerKey, transition.payload);
                }
                const persistedRequest = activeDraftStore
                    ? getOrCreateCandidateSetupStartRequest(
                        activeDraftStore,
                        draftOwnerKey,
                        requestSignature,
                        createSetupStartIdempotencyKey,
                    )
                    : null;
                const fallbackRequest = setupStartRequestRef.current?.requestSignature === requestSignature
                    ? setupStartRequestRef.current
                    : {
                        requestSignature,
                        idempotencyKey: createSetupStartIdempotencyKey(),
                    };
                setupStartRequestRef.current = persistedRequest ?? fallbackRequest;
                result = await createSessionViaSetupRoute(
                    transition,
                    decision,
                    setupEntryMode,
                    setupStartRequestRef.current.idempotencyKey,
                );
            }
            if (result.status === "existing_prep_context_found") {
                if (result.existingPrepContexts.length === 0) {
                    throw new Error("Existing preparation context facts were missing.");
                }
                setPendingSetupTransition(transition);
                setExistingPrepContexts(result.existingPrepContexts);
                setSelectedExistingRoleProfileId(result.existingPrepContexts[0].roleProfileId);
                setIsPreparing(false);
                return;
            }
            if (result.status === "existing_prep_context_selected") {
                clearSubmittedSetupDraft();
                window.location.assign(result.nextRoute);
                return;
            }

            saveCandidateProvisionalSession(window.sessionStorage, result);
            clearSubmittedSetupDraft();
            window.location.assign(result.nextRoute);
        } catch (error) {
            setIsPreparing(false);
            if (
                error instanceof CandidateSetupStartRequestError
                && (error.code === "RESUME_REVIEW_REQUIRED" || error.code === "RESUME_REVIEW_STALE")
                && resumeArtifact
            ) {
                setResumeArtifact(null);
                setResumeReviewMessage("Review this text again with the current privacy protections.");
                saveSetupDraft({ resumeText: "", resumeArtifact: null });
            }
            if (decision) {
                setExistingContextError("I could not create the separate practice path. Your setup is still here, so you can try again.");
            } else {
                setSetupError(error instanceof CandidateSetupStartRequestError
                    ? error.candidateMessage
                    : "I could not start this practice round. Try again.");
            }
        }
    }

    function clearSubmittedSetupDraft() {
        if (activeDraftStore) {
            clearCandidateSetupDraft(activeDraftStore, draftOwnerKey);
        }
    }

    function closeExistingContextDialog() {
        setExistingPrepContexts([]);
        setSelectedExistingRoleProfileId("");
        setPendingSetupTransition(null);
        setExistingContextError("");
    }

    async function viewExistingContext() {
        if (!selectedExistingRoleProfileId) {
            return;
        }
        if (trustedSetupContext && pendingSetupTransition) {
            await performSetupStart(pendingSetupTransition, {
                action: "use_existing_path",
                matchingRoleProfileId: selectedExistingRoleProfileId,
            });
            return;
        }
        clearSubmittedSetupDraft();
        window.location.assign(`/candidate/dashboard?prep=${encodeURIComponent(selectedExistingRoleProfileId)}`);
    }

    async function createSeparatePracticePath() {
        if (!pendingSetupTransition || !selectedExistingRoleProfileId) {
            return;
        }

        await performSetupStart(pendingSetupTransition, {
            action: "create_separate_path",
            matchingRoleProfileId: selectedExistingRoleProfileId,
        });
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
        resumeArtifact: CandidateSetupResumeArtifactReference | null;
        interviewStage: CandidateSetupStageId;
        questionCount: number;
    }> = {}) {
        const nextTargetRole = overrides.targetRole ?? targetRole;
        const nextJobDescription = overrides.jobDescription ?? jobDescription;

        const nextInput = {
            targetRole: nextTargetRole,
            jobDescription: nextJobDescription,
            resumeText: Object.prototype.hasOwnProperty.call(overrides, "resumeText") ? overrides.resumeText : resumeText,
            resumeArtifact: Object.prototype.hasOwnProperty.call(overrides, "resumeArtifact")
                ? overrides.resumeArtifact
                : resumeArtifact
                    ? toResumeArtifactReference(resumeArtifact)
                    : null,
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
                    <div className="setup-panels-split">
                        <section className="setup-panel" aria-labelledby="role-context-label">
                            <div className="setup-section-header">
                                <div>
                                    <p className="type-eyebrow" id="role-context-label">
                                        Role
                                    </p>
                                </div>
                            </div>

                            <div className="setup-field-grid">
                                {trustedSetupContext ? (
                                    <p className="setup-field setup-field--full" id="trusted-role-context">
                                        Role details provided by {trustedSetupContext.sourcePlatform === "talentarbor"
                                            ? "TalentArbor"
                                            : "RangamWorks"}.
                                    </p>
                                ) : null}
                                <label className="setup-field setup-field--full">
                                    <span>Target role *</span>
                                    <input
                                        name="targetRole"
                                        required
                                        maxLength={CANDIDATE_SETUP_LIMITS.targetRole + 1}
                                        aria-invalid={isTargetRoleInvalid}
                                        className={isTargetRoleInvalid ? "is-required-missing" : undefined}
                                        value={targetRole}
                                        readOnly={Boolean(trustedSetupContext)}
                                        aria-describedby={trustedSetupContext ? "trusted-role-context" : undefined}
                                        onChange={(event) => {
                                            userEditedSetupFieldsRef.current.add("targetRole");
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
                                        readOnly={Boolean(trustedSetupContext)}
                                        aria-describedby={trustedSetupContext ? "trusted-role-context" : undefined}
                                        onChange={(event) => {
                                            userEditedSetupFieldsRef.current.add("jobDescription");
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
                                    disabled={isResumeProcessing}
                                    onClick={async () => {
                                        userEditedSetupFieldsRef.current.add("resume");
                                        if (resumeArtifact || resumeText.trim() || resumeAssetName) {
                                            try {
                                                await invalidateResumeSelection();
                                            } catch {
                                                return;
                                            }
                                        }
                                        setResumeSource("paste");
                                        setResumePhotoPages([]);
                                        setResumeAssetName("");
                                        setResumeText("");
                                        setResumeArtifact(null);
                                        setResumeReviewMessage("");
                                        setResumeError("");
                                        saveSetupDraft({ resumeText: "", resumeArtifact: null });
                                    }}
                                >
                                    <FileText size={18} aria-hidden="true" />
                                    <span>Paste text</span>
                                </button>

                                <label className={resumeSource === "file" ? "resume-source is-selected" : "resume-source"}>
                                    <Upload size={18} aria-hidden="true" />
                                    <span>Upload resume</span>
                                    <input
                                        type="file"
                                        name="resumeFile"
                                        accept={CANDIDATE_RESUME_DOCUMENT_ACCEPT}
                                        disabled={isResumeProcessing}
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
                                        disabled={isResumeProcessing}
                                        onChange={(event) => handleResumeAsset(event, "photo")}
                                    />
                                </label>
                            </div>

                            {resumeAssetName ? (
                                <p className="resume-asset-note" aria-live="polite">
                                    Selected: {resumeAssetName}. {isResumeProcessing
                                        ? "Preparing text for review."
                                        : resumeArtifact?.reviewState === "accepted"
                                            ? "Reviewed text is ready to use."
                                            : resumeArtifact?.reviewState === "awaiting_review"
                                                ? "Prepared text is ready for your review."
                                                : "It is not included until processed text is ready."}
                                </p>
                            ) : null}

                            {resumeSource === "photo" && !resumeText ? (
                                <div className="resume-photo-workspace" aria-busy={isResumeProcessing}>
                                    <div className="resume-photo-intro">
                                        <strong>Photograph each page in reading order.</strong>
                                        <span>You can add up to 4 pages, change their order, or choose existing photos instead.</span>
                                    </div>

                                    {resumePhotoPages.length > 0 ? (
                                        <ol className="resume-photo-pages" aria-label="Resume photo page order">
                                            {resumePhotoPages.map((page, index) => (
                                                <li key={page.id}>
                                                    <div>
                                                        <strong>Page {index + 1}</strong>
                                                        <span>{page.file.name || "Resume photo"}</span>
                                                    </div>
                                                    <div className="resume-photo-page-actions">
                                                        <button
                                                            type="button"
                                                            title="Move page up"
                                                            aria-label={`Move page ${index + 1} up`}
                                                            disabled={isResumeProcessing || index === 0}
                                                            onClick={() => moveResumePhotoPage(index, -1)}
                                                        >
                                                            <ArrowUp size={17} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title="Move page down"
                                                            aria-label={`Move page ${index + 1} down`}
                                                            disabled={isResumeProcessing || index === resumePhotoPages.length - 1}
                                                            onClick={() => moveResumePhotoPage(index, 1)}
                                                        >
                                                            <ArrowDown size={17} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title="Remove page"
                                                            aria-label={`Remove page ${index + 1}`}
                                                            disabled={isResumeProcessing}
                                                            onClick={() => removeResumePhotoPage(page.id)}
                                                        >
                                                            <Trash2 size={17} />
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ol>
                                    ) : null}

                                    <div className="resume-photo-controls">
                                        <label className="resume-photo-control">
                                            <Camera size={17} aria-hidden="true" />
                                            <span>{resumePhotoPages.length ? "Add another page" : "Take page photo"}</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                disabled={isResumeProcessing || resumePhotoPages.length >= 4}
                                                onChange={(event) => handleResumeAsset(event, "photo")}
                                            />
                                        </label>
                                        <label className="resume-photo-control">
                                            <Upload size={17} aria-hidden="true" />
                                            <span>Choose photos</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                disabled={isResumeProcessing || resumePhotoPages.length >= 4}
                                                onChange={(event) => handleResumeAsset(event, "photo")}
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            className="resume-review-action"
                                            disabled={isResumeProcessing || resumePhotoPages.length === 0}
                                            onClick={processResumePhotos}
                                        >
                                            {isResumeProcessing ? "Reading pages" : "Review photo text"}
                                            {isResumeProcessing ? <Loader2 className="setup-spinner" size={16} /> : <ArrowRight size={16} />}
                                        </button>
                                    </div>

                                    <p className="resume-photo-fallback">
                                        Camera unavailable? Choose existing photos, upload a PDF or DOCX, or paste the resume text.
                                    </p>
                                </div>
                            ) : null}

                            {resumeSource !== "photo" || resumeText ? (
                                <div className="resume-review-workspace" aria-busy={isResumeProcessing}>
                                    {resumeSource === "paste" || resumeText ? (
                                        <label className="setup-field setup-field--full">
                                            <span>{resumeSource === "paste" ? "Paste resume text" : "Review resume text"}</span>
                                            <textarea
                                                name="resumeText"
                                                maxLength={CANDIDATE_SETUP_LIMITS.resumeText + 1}
                                                value={resumeText}
                                                aria-describedby="resume-review-status"
                                                onChange={(event) => {
                                                    userEditedSetupFieldsRef.current.add("resume");
                                                    clearSetupValidation();
                                                    const nextText = event.target.value;
                                                    setResumeText(nextText);
                                                    setResumeError("");
                                                    if (!nextText.trim()) {
                                                        if (resumeArtifact) {
                                                            void invalidateResumeSelection().catch(() => undefined);
                                                        }
                                                        setResumeArtifact(null);
                                                        setResumeReviewMessage("");
                                                    } else if (resumeArtifact?.reviewState === "accepted") {
                                                        void invalidateResumeSelection().catch(() => undefined);
                                                        setResumeArtifact(null);
                                                        setResumeReviewMessage("Review the updated text before using it for practice.");
                                                    }
                                                    saveSetupDraft({ resumeText: "", resumeArtifact: null });
                                                }}
                                                rows={6}
                                                placeholder="Paste resume text here."
                                            />
                                        </label>
                                    ) : null}

                                    <div className="resume-review-status" id="resume-review-status" aria-live="polite">
                                        <div>
                                            <strong>
                                                {isResumeProcessing
                                                    ? "Preparing resume"
                                                    : resumeArtifact?.reviewState === "accepted"
                                                    ? "Resume ready"
                                                    : resumeArtifact?.reviewState === "awaiting_review"
                                                        ? "Review prepared text"
                                                        : "Prepare resume text"}
                                            </strong>
                                            <span>
                                                {resumeError
                                                    || resumeReviewMessage
                                                    || (resumeArtifact?.reviewState === "awaiting_review"
                                                        ? "Check that the work history is accurate before confirming it."
                                                        : "I will remove direct contact details and let you review the text before it is used.")}
                                            </span>
                                        </div>
                                        {resumeArtifact?.reviewState === "accepted" ? (
                                            <BadgeCheck size={20} aria-hidden="true" />
                                        ) : resumeArtifact?.reviewState === "awaiting_review" ? (
                                            <button
                                                type="button"
                                                className="resume-review-action"
                                                disabled={isResumeProcessing}
                                                onClick={acceptProcessedResume}
                                            >
                                                {isResumeProcessing ? "Checking" : "Use this resume"}
                                                {isResumeProcessing ? <Loader2 className="setup-spinner" size={16} /> : <ArrowRight size={16} />}
                                            </button>
                                        ) : resumeSource === "paste" ? (
                                            <button
                                                type="button"
                                                className="resume-review-action"
                                                disabled={isResumeProcessing || !resumeText.trim()}
                                                onClick={processPastedResume}
                                            >
                                                {isResumeProcessing ? "Preparing" : "Review resume"}
                                                {isResumeProcessing ? <Loader2 className="setup-spinner" size={16} /> : <ArrowRight size={16} />}
                                            </button>
                                        ) : isResumeProcessing ? <Loader2 className="setup-spinner" size={20} aria-hidden="true" /> : null}
                                    </div>
                                </div>
                            ) : null}
                        </section>
                    </div>

                    <section className="setup-panel" aria-labelledby="practice-details-label">
                        <div className="setup-section-header">
                            <div>
                                <p className="type-eyebrow" id="practice-details-label">
                                    Interview details
                                </p>
                            </div>
                        </div>

                        <div className="setup-details-split">
                            <fieldset className="setup-fieldset">
                                <legend>Interview stage *</legend>
                                <div className="stage-grid">
                                    {candidateSetupStageOptions
                                        .filter((stage) => stage.id !== "practice_only")
                                        .map((stage) => (
                                            <button
                                                key={stage.id}
                                                type="button"
                                                className={selectedStage === stage.id ? "stage-card is-selected" : "stage-card"}
                                                aria-pressed={selectedStage === stage.id}
                                                onClick={() => chooseStage(stage)}
                                            >
                                                <strong>{stage.label}</strong>
                                                <span className="stage-card__detail">{stage.detail}</span>
                                            </button>
                                        ))}
                                    {candidateSetupStageOptions
                                        .filter((stage) => stage.id === "practice_only")
                                        .map((stage) => (
                                            <button
                                                key={stage.id}
                                                type="button"
                                                className={`stage-card stage-card--full ${selectedStage === stage.id ? "is-selected" : ""}`}
                                                aria-pressed={selectedStage === stage.id}
                                                onClick={() => chooseStage(stage)}
                                            >
                                                <strong>{stage.label}</strong>
                                                <span className="stage-card__detail">{stage.detail}</span>
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
                                                userEditedSetupFieldsRef.current.add("interviewDetails");
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
                        </div>
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
                                    <span>
                                        {showRequiredAlert && resumeNeedsReview
                                            ? "Review and confirm the resume text, or clear it to continue without a resume."
                                            : "Required fields are marked with an asterisk."}
                                    </span>
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

            <dialog
                ref={existingContextDialogRef}
                className="setup-existing-dialog"
                aria-labelledby="existing-prep-context-title"
                onCancel={(event) => {
                    event.preventDefault();
                    closeExistingContextDialog();
                }}
            >
                <div className="setup-existing-dialog__header">
                    <div>
                        <p className="type-eyebrow">Existing practice</p>
                        <h2 id="existing-prep-context-title">You already have practice for this role.</h2>
                        <p>View an existing path or keep this setup separate.</p>
                    </div>
                    <button
                        type="button"
                        className="setup-existing-dialog__close"
                        aria-label="Close"
                        title="Close"
                        onClick={closeExistingContextDialog}
                    >
                        <X size={18} />
                    </button>
                </div>

                <fieldset className="setup-existing-dialog__choices">
                    <legend className="sr-only">Choose an existing practice path</legend>
                    {existingPrepContexts.map((context) => (
                        <label
                            key={context.roleProfileId}
                            className={
                                selectedExistingRoleProfileId === context.roleProfileId
                                    ? "setup-existing-choice is-selected"
                                    : "setup-existing-choice"
                            }
                        >
                            <input
                                type="radio"
                                name="existingPrepContext"
                                value={context.roleProfileId}
                                checked={selectedExistingRoleProfileId === context.roleProfileId}
                                onChange={() => {
                                    setSelectedExistingRoleProfileId(context.roleProfileId);
                                    setExistingContextError("");
                                }}
                            />
                            <div className="setup-existing-choice__content">
                                <h3>{context.targetRole}</h3>
                                <dl>
                                    <div>
                                        <dt>Created</dt>
                                        <dd>{formatSetupDate(context.createdAt)}</dd>
                                    </div>
                                    <div>
                                        <dt>Last practice</dt>
                                        <dd>{context.lastPracticeActivityAt ? formatSetupDate(context.lastPracticeActivityAt) : "Not started"}</dd>
                                    </div>
                                    <div>
                                        <dt>Stage</dt>
                                        <dd>{toStageLabel(context.interviewStage)}</dd>
                                    </div>
                                    <div>
                                        <dt>Questions</dt>
                                        <dd>{context.questionCount ?? "Not available"}</dd>
                                    </div>
                                    <div>
                                        <dt>Completed sessions</dt>
                                        <dd>{context.completedSessionCount}</dd>
                                    </div>
                                    <div>
                                        <dt>Completed questions</dt>
                                        <dd>{context.completedQuestionCount}</dd>
                                    </div>
                                    {context.activeRound ? (
                                        <div>
                                            <dt>Active round</dt>
                                            <dd>
                                                {context.activeRound.completedQuestionCount} of {context.activeRound.totalQuestionCount} completed
                                            </dd>
                                        </div>
                                    ) : null}
                                </dl>

                                <details className="setup-existing-choice__jd">
                                    <summary>
                                        <span>
                                            <strong>Job description</strong>
                                            <span>{context.jobDescription}</span>
                                        </span>
                                        <ChevronDown size={16} aria-hidden="true" />
                                    </summary>
                                    <p>{context.jobDescription}</p>
                                </details>
                            </div>
                        </label>
                    ))}
                </fieldset>

                {existingContextError ? (
                    <p className="setup-existing-dialog__error" role="alert">
                        <AlertCircle size={17} aria-hidden="true" />
                        <span>{existingContextError}</span>
                    </p>
                ) : null}

                <div className="setup-existing-dialog__actions">
                    <button
                        type="button"
                        className="setup-existing-dialog__secondary"
                        disabled={isPreparing || !selectedExistingRoleProfileId}
                        onClick={createSeparatePracticePath}
                    >
                        {isPreparing ? "Creating separate path" : "Start a separate path"}
                    </button>
                    <button
                        type="button"
                        className="setup-existing-dialog__primary"
                        disabled={isPreparing || !selectedExistingRoleProfileId}
                        onClick={viewExistingContext}
                    >
                        View in dashboard
                        <ArrowRight size={16} aria-hidden="true" />
                    </button>
                </div>
            </dialog>
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

function toResumeArtifactReference(
    artifact: CandidateResumeReviewArtifact,
): CandidateSetupResumeArtifactReference {
    return {
        artifactId: artifact.artifactId,
        version: artifact.version,
        revision: artifact.revision,
        source: artifact.source,
        candidateLabel: artifact.candidateLabel,
        reviewState: artifact.reviewState,
    };
}

async function readCandidateResumeArtifactResponse(response: Response): Promise<{
    outcome?: "accepted" | "review_required";
    artifact: CandidateResumeReviewArtifact;
}> {
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok) {
        const candidateMessage = typeof result.error === "string" && result.error.trim()
            ? result.error.trim()
            : "I could not prepare that resume text. Try again.";
        const code = typeof result.code === "string" ? result.code : null;
        throw new CandidateResumeReviewRequestError(candidateMessage, code);
    }
    const artifact = result.artifact;
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
        throw new CandidateResumeReviewRequestError("I could not recover the prepared resume text. Try again.");
    }
    const record = artifact as Record<string, unknown>;
    if (
        typeof record.artifactId !== "string"
        || typeof record.version !== "number"
        || typeof record.revision !== "number"
        || (
            record.source !== "pasted_text"
            && record.source !== "document_upload"
            && record.source !== "photo_capture"
            && record.source !== "trusted_host"
        )
        || typeof record.candidateLabel !== "string"
        || typeof record.normalizedText !== "string"
        || (record.reviewState !== "awaiting_review" && record.reviewState !== "accepted")
    ) {
        throw new CandidateResumeReviewRequestError("I could not recover the prepared resume text. Try again.");
    }
    return {
        outcome: result.outcome === "accepted" || result.outcome === "review_required" ? result.outcome : undefined,
        artifact: {
            artifactId: record.artifactId,
            version: record.version,
            revision: record.revision,
            source: record.source,
            candidateLabel: record.candidateLabel,
            normalizedText: record.normalizedText,
            piiRedactionCounts: record.piiRedactionCounts && typeof record.piiRedactionCounts === "object"
                ? record.piiRedactionCounts as Record<string, number>
                : {},
            reviewState: record.reviewState,
            createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
            acceptedAt: typeof record.acceptedAt === "string" ? record.acceptedAt : null,
        },
    };
}

function toResumeUiSource(source: CandidateSetupResumeArtifactReference["source"] | undefined): ResumeSource {
    return source === "document_upload" ? "file" : source === "photo_capture" ? "photo" : "paste";
}

function resolveResumeDocumentMimeType(file: File) {
    const declaredType = file.type.split(";", 1)[0]?.trim().toLowerCase();
    const normalizedName = file.name.trim().toLowerCase();
    const isGenericType = !declaredType || declaredType === "application/octet-stream";
    if (normalizedName.endsWith(".pdf") && (isGenericType || declaredType === "application/pdf")) {
        return "application/pdf";
    }
    if (
        normalizedName.endsWith(".docx")
        && (isGenericType || declaredType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ) {
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    return null;
}

let resumePhotoPageSequence = 0;

function createResumePhotoPageId() {
    resumePhotoPageSequence += 1;
    return `resume-photo-${Date.now()}-${resumePhotoPageSequence}`;
}

async function createSessionViaSetupRoute(
    transition: CandidateSetupTransition,
    decision?: CandidateSetupPrepContextDecision,
    setupEntryMode: "trusted_host_job" | null = null,
    idempotencyKey?: string,
): Promise<CandidateSetupStartResult> {
    const response = await fetch("/candidate/setup/start", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify({
            ...transition.payload,
            ...(decision ? { prepContextDecision: decision } : {}),
            ...(setupEntryMode ? { setupEntryMode } : {}),
        }),
    });

    const result = await response.json() as CandidateSetupStartResult | {
        error?: unknown;
        code?: unknown;
    };

    if (
        response.status === 409
        && result
        && typeof result === "object"
        && "status" in result
        && result.status === "existing_prep_context_found"
    ) {
        return result;
    }

    if (!response.ok) {
        const responseCode = result
            && typeof result === "object"
            && "code" in result
            && typeof result.code === "string"
            ? result.code
            : null;
        const isCandidateSafeFailure = responseCode?.startsWith("QUESTION_WORDING_PROVIDER_")
            || responseCode === "SETUP_START_IDEMPOTENCY_KEY_REQUIRED"
            || responseCode === "SETUP_START_IDEMPOTENCY_CONFLICT"
            || responseCode === "SETUP_START_IN_PROGRESS"
            || responseCode === "SETUP_START_CLAIM_LOST"
            || responseCode === "RESUME_REVIEW_REQUIRED"
            || responseCode === "RESUME_REVIEW_STALE"
            || responseCode === "RESUME_REVIEW_UNAVAILABLE";
        const candidateMessage = isCandidateSafeFailure
            && typeof result === "object"
            && "error" in result
            && typeof result.error === "string"
            && result.error.trim()
            ? result.error.trim()
            : "I could not start this practice round. Try again.";
        throw new CandidateSetupStartRequestError(candidateMessage, responseCode);
    }

    return result as CandidateSetupSessionCreationResult;
}

async function createSetupStartRequestSignature(
    transition: CandidateSetupTransition,
    decision: CandidateSetupPrepContextDecision | undefined,
    setupEntryMode: "trusted_host_job" | null,
) {
    const canonicalRequest = JSON.stringify({
        setup: transition.payload,
        setupEntryMode,
        prepContextDecision: decision ?? null,
    });
    if (typeof window !== "undefined" && window.crypto?.subtle) {
        try {
            const digest = await window.crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(canonicalRequest),
            );
            return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
        } catch {
            // The server fingerprint remains authoritative; this fallback only rotates browser retry keys.
        }
    }

    let fallbackHash = 0x811c9dc5;
    for (let index = 0; index < canonicalRequest.length; index += 1) {
        fallbackHash ^= canonicalRequest.charCodeAt(index);
        fallbackHash = Math.imul(fallbackHash, 0x01000193);
    }
    return `fallback-${(fallbackHash >>> 0).toString(16).padStart(8, "0")}-${canonicalRequest.length}`;
}

function createSetupStartIdempotencyKey() {
    if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    return `setup-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function createResumeSelectionOperationId() {
    if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function formatSetupDate(value: string) {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(value));
}

function toStageLabel(stage: CandidateSetupStageId | null) {
    return candidateSetupStageOptions.find((option) => option.id === stage)?.label ?? "Not available";
}
