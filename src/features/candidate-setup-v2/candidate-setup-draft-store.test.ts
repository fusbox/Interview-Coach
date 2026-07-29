import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    CANDIDATE_SETUP_DRAFT_STORAGE_KEY,
    clearCandidateSetupDraft,
    createCandidateSetupBrowserDraftStore,
    createCandidateSetupMemoryDraftStore,
    getOrCreateCandidateSetupStartRequest,
    restoreCandidateSetupDraft,
    saveCandidateSetupDraft,
    toCandidateSetupDraftFormState,
} from "./candidate-setup-draft-store";

describe("candidate setup draft store", () => {
    const ownerKey = "candidate:local-dev";

    beforeEach(() => {
        localStorage.clear();
    });

    it("keeps raw resume paste out of the browser draft while preserving setup fields", () => {
        const store = createCandidateSetupMemoryDraftStore();

        const draft = saveCandidateSetupDraft(store, ownerKey, {
            targetRole: " Customer service representative ",
            jobDescription: " Help customers resolve service questions. ",
            resumeText: " Supported a high-volume front desk. ",
            interviewStage: "screening",
            questionCount: "5",
        });

        expect(draft).toMatchObject({
            ownerKey,
            status: "draft",
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: null,
            interviewStage: "screening",
            questionCount: 5,
            resumeCaptureMode: "none",
            resumeTargetScreen: "candidate_setup",
        });
        expect(draft.id).toBe("setup-draft-candidate-local-dev");
        expect(draft.createdAt).toEqual(expect.any(String));
        expect(draft.updatedAt).toEqual(expect.any(String));
    });

    it("preserves only reviewed processed resume text with its server artifact reference", () => {
        const store = createCandidateSetupMemoryDraftStore();
        const resumeArtifact = {
            artifactId: "20000000-0000-4000-8000-000000000001",
            version: 1,
            revision: 2,
            source: "pasted_text" as const,
            candidateLabel: "Pasted resume",
            reviewState: "accepted" as const,
        };

        const draft = saveCandidateSetupDraft(store, ownerKey, {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: "Supported a high-volume front desk.",
            resumeArtifact,
            interviewStage: "screening",
            questionCount: 5,
        });

        expect(draft).toMatchObject({
            resumeText: "Supported a high-volume front desk.",
            resumeCaptureMode: "pasted_text",
            resumeArtifact,
        });
        expect(toCandidateSetupDraftFormState(draft)).toMatchObject({
            resumeText: "Supported a high-volume front desk.",
            resumeArtifact,
        });
    });

    it("preserves an awaiting-review artifact reference without its processed text", () => {
        const store = createCandidateSetupMemoryDraftStore();
        const resumeArtifact = {
            artifactId: "20000000-0000-4000-8000-000000000003",
            version: 1,
            revision: 1,
            source: "photo_capture" as const,
            candidateLabel: "2 resume photos",
            reviewState: "awaiting_review" as const,
        };
        const draft = saveCandidateSetupDraft(store, ownerKey, {
            targetRole: "Inventory lead",
            jobDescription: "Manage inventory and shipments.",
            resumeText: "Processed server-owned text.",
            resumeArtifact,
        });

        expect(draft).toMatchObject({
            resumeText: null,
            resumeArtifact,
        });
        expect(toCandidateSetupDraftFormState(draft)).toEqual(expect.objectContaining({
            resumeText: "",
            resumeArtifact,
        }));
    });

    it("restores accepted document text without retaining document bytes", () => {
        const store = createCandidateSetupMemoryDraftStore();
        const resumeArtifact = {
            artifactId: "20000000-0000-4000-8000-000000000002",
            version: 1,
            revision: 2,
            source: "document_upload" as const,
            candidateLabel: "resume.pdf",
            reviewState: "accepted" as const,
        };

        const draft = saveCandidateSetupDraft(store, ownerKey, {
            targetRole: "Quality inspector",
            jobDescription: "Inspect products and document defects.",
            resumeText: "Inspected production records and documented defects.",
            resumeArtifact,
        });

        expect(draft).toMatchObject({
            resumeCaptureMode: "document_upload",
            resumeText: "Inspected production records and documented defects.",
            resumeArtifact,
        });
        expect(JSON.stringify(draft)).not.toContain("sourceBytes");
        expect(JSON.stringify(draft)).not.toContain("sourceFile");
    });

    it("preserves one explicit resume input mode without requiring a raw source or artifact", () => {
        const store = createCandidateSetupMemoryDraftStore();

        const draft = saveCandidateSetupDraft(store, ownerKey, {
            targetRole: "Quality inspector",
            jobDescription: "Inspect products and document defects.",
            resumeInputMode: "file",
        });

        expect(draft).toMatchObject({
            resumeInputMode: "file",
            resumeText: null,
        });
        expect(draft.resumeArtifact ?? null).toBeNull();
        expect(toCandidateSetupDraftFormState(draft)).toMatchObject({
            resumeInputMode: "file",
            resumeText: "",
            resumeArtifact: null,
        });

        expect(saveCandidateSetupDraft(store, ownerKey, {
            targetRole: "Senior quality inspector",
            jobDescription: "Inspect products and document defects.",
        })).toMatchObject({
            resumeInputMode: "file",
        });
    });

    it("derives the resume input mode for a pre-mode browser draft from its artifact source", () => {
        const store = createCandidateSetupBrowserDraftStore(window.localStorage);
        const acceptedDocumentArtifact = {
            artifactId: "20000000-0000-4000-8000-000000000002",
            version: 1,
            revision: 2,
            source: "document_upload" as const,
            candidateLabel: "resume.pdf",
            reviewState: "accepted" as const,
        };
        const storedDraft = saveCandidateSetupDraft(store, ownerKey, {
            targetRole: "Quality inspector",
            jobDescription: "Inspect products and document defects.",
            resumeText: "Inspected production records and documented defects.",
            resumeArtifact: acceptedDocumentArtifact,
        });
        const persistedDrafts = JSON.parse(
            window.localStorage.getItem(CANDIDATE_SETUP_DRAFT_STORAGE_KEY) ?? "{}",
        ) as Record<string, Record<string, unknown>>;
        delete persistedDrafts[ownerKey]?.resumeInputMode;
        window.localStorage.setItem(CANDIDATE_SETUP_DRAFT_STORAGE_KEY, JSON.stringify(persistedDrafts));

        const restored = createCandidateSetupBrowserDraftStore(window.localStorage).readDraft(ownerKey);

        expect(storedDraft.resumeInputMode).toBe("file");
        expect(restored).toMatchObject({
            resumeInputMode: "file",
            resumeArtifact: acceptedDocumentArtifact,
        });
    });

    it("restores the latest editable draft for the same owner key", () => {
        const store = createCandidateSetupMemoryDraftStore();

        saveCandidateSetupDraft(store, ownerKey, {
            targetRole: "Warehouse lead",
            jobDescription: "Coordinate safety workflows.",
            interviewStage: "first_interview",
            questionCount: 7,
        });

        expect(restoreCandidateSetupDraft(store, ownerKey)).toMatchObject({
            targetRole: "Warehouse lead",
            jobDescription: "Coordinate safety workflows.",
            resumeText: null,
            interviewStage: "first_interview",
            questionCount: 7,
        });
        expect(restoreCandidateSetupDraft(store, "candidate:other")).toBeNull();
    });

    it("keeps createdAt stable while updating the saved draft", () => {
        const store = createCandidateSetupMemoryDraftStore();

        const firstDraft = saveCandidateSetupDraft(store, ownerKey, {
            targetRole: "Assembler",
            jobDescription: "Build product assemblies.",
        });
        const updatedDraft = saveCandidateSetupDraft(store, ownerKey, {
            targetRole: "Assembler II",
            jobDescription: "Build and inspect product assemblies.",
            interviewStage: "follow_up",
            questionCount: 10,
        });

        expect(updatedDraft.id).toBe(firstDraft.id);
        expect(updatedDraft.createdAt).toBe(firstDraft.createdAt);
        expect(updatedDraft.updatedAt >= firstDraft.updatedAt).toBe(true);
        expect(restoreCandidateSetupDraft(store, ownerKey)).toMatchObject({
            targetRole: "Assembler II",
            interviewStage: "follow_up",
            questionCount: 10,
        });
    });

    it("can restore a draft through the browser storage adapter after remount", () => {
        const store = createCandidateSetupBrowserDraftStore(window.localStorage);

        saveCandidateSetupDraft(store, ownerKey, {
            targetRole: "Medical assistant",
            jobDescription: "Support patients and clinical staff.",
            interviewStage: "screening",
            questionCount: 5,
        });

        const remountedStore = createCandidateSetupBrowserDraftStore(window.localStorage);

        expect(restoreCandidateSetupDraft(remountedStore, ownerKey)).toMatchObject({
            targetRole: "Medical assistant",
            jobDescription: "Support patients and clinical staff.",
            interviewStage: "screening",
            questionCount: 5,
        });
        expect(localStorage.getItem(CANDIDATE_SETUP_DRAFT_STORAGE_KEY)).toContain("Medical assistant");
    });

    it("clears only the submitted draft for the same owner key", () => {
        const store = createCandidateSetupMemoryDraftStore();
        saveCandidateSetupDraft(store, ownerKey, {
            targetRole: "Medical assistant",
            jobDescription: "Support patients and clinical staff.",
        });
        saveCandidateSetupDraft(store, "candidate:other", {
            targetRole: "Warehouse lead",
            jobDescription: "Coordinate safety workflows.",
        });

        clearCandidateSetupDraft(store, ownerKey);

        expect(restoreCandidateSetupDraft(store, ownerKey)).toBeNull();
        expect(restoreCandidateSetupDraft(store, "candidate:other")).toMatchObject({
            targetRole: "Warehouse lead",
        });
    });

    it("keeps one setup-start key for the same request signature and rotates it after setup changes", () => {
        const store = createCandidateSetupMemoryDraftStore();
        const createIdempotencyKey = vi.fn()
            .mockReturnValueOnce("setup-request-key-0001")
            .mockReturnValueOnce("setup-request-key-0002");
        saveCandidateSetupDraft(store, ownerKey, {
            targetRole: "Medical assistant",
            jobDescription: "Support patients and clinical staff.",
        });

        expect(getOrCreateCandidateSetupStartRequest(
            store,
            ownerKey,
            "signature-one",
            createIdempotencyKey,
        )).toEqual({
            requestSignature: "signature-one",
            idempotencyKey: "setup-request-key-0001",
        });
        expect(getOrCreateCandidateSetupStartRequest(
            store,
            ownerKey,
            "signature-one",
            createIdempotencyKey,
        )).toEqual({
            requestSignature: "signature-one",
            idempotencyKey: "setup-request-key-0001",
        });

        saveCandidateSetupDraft(store, ownerKey, {
            targetRole: "Medical assistant",
            jobDescription: "Support patients, clinical staff, and scheduling.",
        });

        expect(getOrCreateCandidateSetupStartRequest(
            store,
            ownerKey,
            "signature-two",
            createIdempotencyKey,
        )).toEqual({
            requestSignature: "signature-two",
            idempotencyKey: "setup-request-key-0002",
        });
        expect(createIdempotencyKey).toHaveBeenCalledTimes(2);
    });
});
