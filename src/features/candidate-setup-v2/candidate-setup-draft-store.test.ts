import { beforeEach, describe, expect, it } from "vitest";

import {
    CANDIDATE_SETUP_DRAFT_STORAGE_KEY,
    clearCandidateSetupDraft,
    createCandidateSetupBrowserDraftStore,
    createCandidateSetupMemoryDraftStore,
    restoreCandidateSetupDraft,
    saveCandidateSetupDraft,
} from "./candidate-setup-draft-store";

describe("candidate setup draft store", () => {
    const ownerKey = "candidate:local-dev";

    beforeEach(() => {
        localStorage.clear();
    });

    it("creates an editable draft from normalized setup values", () => {
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
            resumeText: "Supported a high-volume front desk.",
            interviewStage: "screening",
            questionCount: 5,
            resumeCaptureMode: "pasted_text",
            resumeTargetScreen: "candidate_setup",
        });
        expect(draft.id).toBe("setup-draft-candidate-local-dev");
        expect(draft.createdAt).toEqual(expect.any(String));
        expect(draft.updatedAt).toEqual(expect.any(String));
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
});
