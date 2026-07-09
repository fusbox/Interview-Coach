import {
    parseCandidateSetupInput,
    type CandidateSetupPayload,
    type CandidateSetupStageId,
} from "./candidate-setup-contract";

export const CANDIDATE_SETUP_DRAFT_STORAGE_KEY = "interview-coach:candidate-setup-drafts:v1";

export type CandidateSetupDraftStatus = "draft";
export type CandidateSetupResumeTargetScreen = "candidate_setup";

export type CandidateSetupDraft = CandidateSetupPayload & {
    id: string;
    ownerKey: string;
    status: CandidateSetupDraftStatus;
    resumeTargetScreen: CandidateSetupResumeTargetScreen;
    createdAt: string;
    updatedAt: string;
};

export type CandidateSetupDraftInput = {
    targetRole?: unknown;
    jobDescription?: unknown;
    resumeText?: unknown;
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
    const payload = parseCandidateSetupInput({
        targetRole: input.targetRole,
        jobDescription: input.jobDescription,
        resumeText: input.resumeText,
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
        createdAt: previousDraft?.createdAt ?? timestamp,
        updatedAt: timestamp,
    };

    store.writeDraft(draft);
    return draft;
}

export function toCandidateSetupDraftFormState(draft: CandidateSetupDraft | null): {
    targetRole: string;
    jobDescription: string;
    resumeText: string;
    interviewStage: CandidateSetupStageId;
    questionCount: number;
} {
    return {
        targetRole: draft?.targetRole ?? "",
        jobDescription: draft?.jobDescription ?? "",
        resumeText: draft?.resumeText ?? "",
        interviewStage: draft?.interviewStage ?? "first_interview",
        questionCount: draft?.questionCount ?? 7,
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

function readBrowserDrafts(storage: Storage): Record<string, CandidateSetupDraft> {
    const storedDrafts = storage.getItem(CANDIDATE_SETUP_DRAFT_STORAGE_KEY);
    if (!storedDrafts) {
        return {};
    }

    try {
        const parsedDrafts = JSON.parse(storedDrafts);
        return parsedDrafts && typeof parsedDrafts === "object" && !Array.isArray(parsedDrafts)
            ? parsedDrafts as Record<string, CandidateSetupDraft>
            : {};
    } catch {
        return {};
    }
}
