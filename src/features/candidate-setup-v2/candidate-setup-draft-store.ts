import {
    parseCandidateSetupInput,
    type CandidateSetupPayload,
    type CandidateSetupResumeArtifactReference,
    type CandidateSetupStageId,
} from "./candidate-setup-contract";

export const CANDIDATE_SETUP_DRAFT_STORAGE_KEY = "interview-coach:candidate-setup-drafts:v1";

export type CandidateSetupDraftStatus = "draft";
export type CandidateSetupResumeTargetScreen = "candidate_setup";
export type CandidateSetupResumeInputMode = "paste" | "file" | "photo";

export type CandidateSetupDraft = CandidateSetupPayload & {
    id: string;
    ownerKey: string;
    status: CandidateSetupDraftStatus;
    resumeTargetScreen: CandidateSetupResumeTargetScreen;
    resumeInputMode: CandidateSetupResumeInputMode;
    createdAt: string;
    updatedAt: string;
    setupStartRequest?: CandidateSetupStartRequestMarker;
};

export type CandidateSetupStartRequestMarker = {
    requestSignature: string;
    idempotencyKey: string;
};

export type CandidateSetupDraftInput = {
    targetRole?: unknown;
    jobDescription?: unknown;
    resumeText?: unknown;
    resumeArtifact?: unknown;
    resumeInputMode?: unknown;
    interviewStage?: unknown;
    questionCount?: unknown;
};

export type CandidateSetupDraftStore = {
    readDraft: (ownerKey: string) => CandidateSetupDraft | null;
    writeDraft: (draft: CandidateSetupDraft) => void;
    clearDraft: (ownerKey: string) => void;
};

export function createCandidateSetupMemoryDraftStore(initialDrafts: CandidateSetupDraft[] = []): CandidateSetupDraftStore {
    const draftsByOwner = new Map(initialDrafts.map((draft) => [draft.ownerKey, draft]));

    return {
        readDraft(ownerKey) {
            return draftsByOwner.get(ownerKey) ?? null;
        },
        writeDraft(draft) {
            draftsByOwner.set(draft.ownerKey, draft);
        },
        clearDraft(ownerKey) {
            draftsByOwner.delete(ownerKey);
        },
    };
}

export function createCandidateSetupBrowserDraftStore(storage: Storage): CandidateSetupDraftStore {
    return {
        readDraft(ownerKey) {
            return readBrowserDrafts(storage)[ownerKey] ?? null;
        },
        writeDraft(draft) {
            const drafts = readBrowserDrafts(storage);
            drafts[draft.ownerKey] = draft;
            storage.setItem(CANDIDATE_SETUP_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
        },
        clearDraft(ownerKey) {
            const drafts = readBrowserDrafts(storage);
            delete drafts[ownerKey];

            if (Object.keys(drafts).length === 0) {
                storage.removeItem(CANDIDATE_SETUP_DRAFT_STORAGE_KEY);
                return;
            }

            storage.setItem(CANDIDATE_SETUP_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
        },
    };
}

export function restoreCandidateSetupDraft(store: CandidateSetupDraftStore, ownerKey: string): CandidateSetupDraft | null {
    return store.readDraft(ownerKey);
}

export function clearCandidateSetupDraft(store: CandidateSetupDraftStore, ownerKey: string): void {
    store.clearDraft(ownerKey);
}

export function saveCandidateSetupDraft(
    store: CandidateSetupDraftStore,
    ownerKey: string,
    input: CandidateSetupDraftInput,
): CandidateSetupDraft {
    const previousDraft = store.readDraft(ownerKey);
    const hasResumeArtifactInput = Object.prototype.hasOwnProperty.call(input, "resumeArtifact");
    const hasResumeTextInput = Object.prototype.hasOwnProperty.call(input, "resumeText");
    const resumeArtifact = hasResumeArtifactInput
        ? input.resumeArtifact
        : hasResumeTextInput && input.resumeText !== previousDraft?.resumeText
            ? null
            : previousDraft?.resumeArtifact ?? null;
    const resumeInputMode = normalizeResumeInputMode(
        Object.prototype.hasOwnProperty.call(input, "resumeInputMode")
            ? input.resumeInputMode
            : previousDraft?.resumeInputMode,
        resumeArtifact,
    );
    const payload = parseCandidateSetupInput({
        targetRole: input.targetRole,
        jobDescription: input.jobDescription,
        resumeText: isAcceptedResumeArtifactInput(resumeArtifact)
            ? input.resumeText ?? previousDraft?.resumeText
            : null,
        resumeArtifact,
        interviewStage: input.interviewStage ?? previousDraft?.interviewStage,
        questionCount: input.questionCount ?? previousDraft?.questionCount,
    });
    const timestamp = new Date().toISOString();
    const draft: CandidateSetupDraft = {
        ...payload,
        id: previousDraft?.id ?? createCandidateSetupDraftId(ownerKey),
        ownerKey,
        status: "draft",
        resumeTargetScreen: "candidate_setup",
        resumeInputMode,
        createdAt: previousDraft?.createdAt ?? timestamp,
        updatedAt: timestamp,
        ...(previousDraft && hasSameSetupPayload(previousDraft, payload) && previousDraft.setupStartRequest
            ? { setupStartRequest: previousDraft.setupStartRequest }
            : {}),
    };

    store.writeDraft(draft);
    return draft;
}

export function getOrCreateCandidateSetupStartRequest(
    store: CandidateSetupDraftStore,
    ownerKey: string,
    requestSignature: string,
    createIdempotencyKey: () => string,
): CandidateSetupStartRequestMarker | null {
    const draft = store.readDraft(ownerKey);
    if (!draft) {
        return null;
    }
    if (
        draft.setupStartRequest?.requestSignature === requestSignature
        && isValidSetupStartIdempotencyKey(draft.setupStartRequest.idempotencyKey)
    ) {
        return draft.setupStartRequest;
    }

    const setupStartRequest = {
        requestSignature,
        idempotencyKey: createIdempotencyKey(),
    };
    store.writeDraft({
        ...draft,
        setupStartRequest,
        updatedAt: new Date().toISOString(),
    });
    return setupStartRequest;
}

export function toCandidateSetupDraftFormState(draft: CandidateSetupDraft | null): {
    targetRole: string;
    jobDescription: string;
    resumeText: string;
    interviewStage: CandidateSetupStageId;
    questionCount: number;
    resumeArtifact: CandidateSetupResumeArtifactReference | null;
    resumeInputMode: CandidateSetupResumeInputMode;
} {
    const resumeArtifact = draft?.resumeArtifact ?? null;
    return {
        targetRole: draft?.targetRole ?? "",
        jobDescription: draft?.jobDescription ?? "",
        resumeText: resumeArtifact?.reviewState === "accepted" ? draft?.resumeText ?? "" : "",
        interviewStage: draft?.interviewStage ?? "first_interview",
        questionCount: draft?.questionCount ?? 7,
        resumeArtifact,
        resumeInputMode: normalizeResumeInputMode(draft?.resumeInputMode, resumeArtifact),
    };
}

function createCandidateSetupDraftId(ownerKey: string) {
    const safeOwnerKey = ownerKey
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return `setup-draft-${safeOwnerKey || "local-candidate"}`;
}

function hasSameSetupPayload(left: CandidateSetupPayload, right: CandidateSetupPayload) {
    return left.targetRole === right.targetRole
        && left.jobDescription === right.jobDescription
        && left.resumeText === right.resumeText
        && left.interviewStage === right.interviewStage
        && left.questionCount === right.questionCount
        && left.resumeCaptureMode === right.resumeCaptureMode
        && JSON.stringify(left.resumeArtifact ?? null) === JSON.stringify(right.resumeArtifact ?? null);
}

function isValidSetupStartIdempotencyKey(value: string) {
    return value.length >= 16
        && value.length <= 128
        && /^[A-Za-z0-9._:-]+$/.test(value);
}

function isAcceptedResumeArtifactInput(value: unknown): value is CandidateSetupResumeArtifactReference {
    return Boolean(
        value
        && typeof value === "object"
        && !Array.isArray(value)
        && (value as { reviewState?: unknown }).reviewState === "accepted",
    );
}

function normalizeResumeInputMode(
    value: unknown,
    resumeArtifact: unknown,
): CandidateSetupResumeInputMode {
    if (value === "paste" || value === "file" || value === "photo") {
        return value;
    }
    if (resumeArtifact && typeof resumeArtifact === "object" && !Array.isArray(resumeArtifact)) {
        const source = (resumeArtifact as { source?: unknown }).source;
        if (source === "document_upload") {
            return "file";
        }
        if (source === "photo_capture") {
            return "photo";
        }
    }
    return "paste";
}

function readBrowserDrafts(storage: Storage): Record<string, CandidateSetupDraft> {
    const storedDrafts = storage.getItem(CANDIDATE_SETUP_DRAFT_STORAGE_KEY);
    if (!storedDrafts) {
        return {};
    }

    try {
        const parsedDrafts = JSON.parse(storedDrafts);
        if (!parsedDrafts || typeof parsedDrafts !== "object" || Array.isArray(parsedDrafts)) {
            return {};
        }
        return Object.fromEntries(Object.entries(parsedDrafts).flatMap(([ownerKey, value]) => {
            if (!value || typeof value !== "object" || Array.isArray(value)) {
                return [];
            }
            const draft = value as CandidateSetupDraft;
            const safeDraft: CandidateSetupDraft = draft.resumeText && draft.resumeArtifact?.reviewState !== "accepted"
                ? {
                    ...draft,
                    resumeText: null,
                    resumeCaptureMode: draft.resumeArtifact?.source ?? "none",
                }
                : draft;
            return [[ownerKey, {
                ...safeDraft,
                resumeInputMode: normalizeResumeInputMode(safeDraft.resumeInputMode, safeDraft.resumeArtifact),
            } satisfies CandidateSetupDraft]];
        }));
    } catch {
        return {};
    }
}
