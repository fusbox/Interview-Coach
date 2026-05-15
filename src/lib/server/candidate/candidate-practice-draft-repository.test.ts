import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    queryPostgresMock,
} = vi.hoisted(() => ({
    queryPostgresMock: vi.fn(),
}));

vi.mock("@/lib/server/db/postgres", () => ({
    queryPostgres: queryPostgresMock,
}));

describe("candidate practice draft repository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates a candidate-owned draft from validated setup input", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [practiceDraftRow({
                practice_draft_id: "draft-1",
                candidate_profile_id: "profile-1",
                target_role: "QA analyst",
                job_description: "Test regulated workflows.",
                resume_context_json: {
                    pastedText: "Validated releases\n\nReduced defects by 30%",
                    extractedText: "Validated releases\n\nReduced defects by 30%",
                    captureMode: "pasted_text",
                    processedArtifact: {
                        text: "Validated releases\n\nReduced defects by 30%",
                        source: "pasted_text",
                        originalRetained: false,
                    },
                },
            })],
        });

        const { createCandidatePracticeDraft } = await import("./candidate-practice-draft-repository");

        await expect(createCandidatePracticeDraft({
            candidateProfileId: "profile-1",
            targetRole: " QA analyst ",
            jobDescription: " Test regulated workflows. ",
            resumeText: " Validated\t\treleases\r\n\r\n\r\nReduced\u00a0defects by 30% ",
        })).resolves.toMatchObject({
            practiceDraftId: "draft-1",
            candidateProfileId: "profile-1",
            status: "draft",
            targetRole: "QA analyst",
            jobDescription: "Test regulated workflows.",
            resumeContext: {
                pastedText: "Validated releases\n\nReduced defects by 30%",
                extractedText: "Validated releases\n\nReduced defects by 30%",
                captureMode: "pasted_text",
                processedArtifact: {
                    text: "Validated releases\n\nReduced defects by 30%",
                    source: "pasted_text",
                    originalRetained: false,
                },
            },
            resumeTargetScreen: "practice_setup",
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("insert into public.candidate_practice_drafts"),
            expect.arrayContaining([
                "profile-1",
                "QA analyst",
                "Test regulated workflows.",
                expect.objectContaining({
                    pastedText: "Validated releases\n\nReduced defects by 30%",
                    extractedText: "Validated releases\n\nReduced defects by 30%",
                    captureMode: "pasted_text",
                    processedArtifact: {
                        text: "Validated releases\n\nReduced defects by 30%",
                        source: "pasted_text",
                        originalRetained: false,
                    },
                }),
                {
                    confidenceLevel: null,
                    interviewType: null,
                    timeline: null,
                    concerns: null,
                    practiceFocus: [],
                },
            ]),
        );
        expect(queryPostgresMock.mock.calls[0][0]).toContain("values ($1, $2, $3, $4, '[]'::jsonb, $5, 'practice_setup', now())");
        expect(queryPostgresMock.mock.calls[0][0]).not.toContain("'[]'::jsonb, 'practice_setup'");
    });

    it("finds a draft only through candidate ownership", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [practiceDraftRow({
                practice_draft_id: "draft-2",
                candidate_profile_id: "profile-2",
                target_role: "Operations lead",
            })],
        });

        const { findCandidatePracticeDraftById } = await import("./candidate-practice-draft-repository");

        await expect(findCandidatePracticeDraftById({
            candidateProfileId: "profile-2",
            practiceDraftId: "draft-2",
        })).resolves.toMatchObject({
            practiceDraftId: "draft-2",
            candidateProfileId: "profile-2",
            targetRole: "Operations lead",
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("where practice_draft_id = $1 and candidate_profile_id = $2"),
            ["draft-2", "profile-2"],
        );
    });

    it("finds a draft by session only through candidate ownership", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [practiceDraftRow({
                practice_draft_id: "draft-session",
                candidate_profile_id: "profile-session",
                target_role: "Operations analyst",
                session_id: "11111111-1111-4111-8111-111111111111",
            })],
        });

        const { findCandidatePracticeDraftBySessionId } = await import("./candidate-practice-draft-repository");

        await expect(findCandidatePracticeDraftBySessionId({
            candidateProfileId: "profile-session",
            sessionId: "11111111-1111-4111-8111-111111111111",
        })).resolves.toMatchObject({
            practiceDraftId: "draft-session",
            candidateProfileId: "profile-session",
            sessionId: "11111111-1111-4111-8111-111111111111",
            targetRole: "Operations analyst",
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("where session_id = $1 and candidate_profile_id = $2"),
            ["11111111-1111-4111-8111-111111111111", "profile-session"],
        );
    });

    it("finds the latest editable draft for a candidate", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [practiceDraftRow({
                practice_draft_id: "draft-latest",
                candidate_profile_id: "profile-2",
                target_role: "Quality manager",
            })],
        });

        const { findLatestEditableCandidatePracticeDraft } = await import("./candidate-practice-draft-repository");

        await expect(findLatestEditableCandidatePracticeDraft("profile-2")).resolves.toMatchObject({
            practiceDraftId: "draft-latest",
            candidateProfileId: "profile-2",
            targetRole: "Quality manager",
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("where candidate_profile_id = $1 and status = 'draft'"),
            ["profile-2"],
        );
        expect(queryPostgresMock.mock.calls[0][0]).toContain("order by last_activity_at desc");
        expect(queryPostgresMock.mock.calls[0][0]).toContain("limit 1");
    });

    it("lists editable draft summaries for candidate-owned draft selection", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [
                practiceDraftRow({
                    practice_draft_id: "draft-new",
                    candidate_profile_id: "profile-2",
                    target_role: "Operations analyst",
                    last_activity_at: "2026-05-12T12:00:00.000Z",
                    created_at: "2026-05-12T09:00:00.000Z",
                }),
                practiceDraftRow({
                    practice_draft_id: "draft-old",
                    candidate_profile_id: "profile-2",
                    target_role: "Warehouse lead",
                    last_activity_at: "2026-05-11T12:00:00.000Z",
                    created_at: "2026-05-10T09:00:00.000Z",
                }),
            ],
        });

        const { listEditableCandidatePracticeDraftSummaries } = await import("./candidate-practice-draft-repository");

        await expect(listEditableCandidatePracticeDraftSummaries("profile-2")).resolves.toEqual([
            {
                practiceDraftId: "draft-new",
                draftLabel: "Operations analyst",
                targetRole: "Operations analyst",
                status: "draft",
                resumeTargetScreen: "practice_setup",
                lastActivityAt: "2026-05-12T12:00:00.000Z",
                createdAt: "2026-05-12T09:00:00.000Z",
            },
            {
                practiceDraftId: "draft-old",
                draftLabel: "Warehouse lead",
                targetRole: "Warehouse lead",
                status: "draft",
                resumeTargetScreen: "practice_setup",
                lastActivityAt: "2026-05-11T12:00:00.000Z",
                createdAt: "2026-05-10T09:00:00.000Z",
            },
        ]);

        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("where candidate_profile_id = $1 and status = 'draft'"),
            ["profile-2"],
        );
        expect(queryPostgresMock.mock.calls[0][0]).toContain("order by last_activity_at desc");
    });

    it("updates draft setup fields while preserving candidate ownership", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [practiceDraftRow({
                practice_draft_id: "draft-3",
                candidate_profile_id: "profile-3",
                target_role: "Warehouse supervisor",
                job_description: null,
                resume_context_json: { pastedText: null, extractedText: "", captureMode: "none" },
            })],
        });

        const { updateCandidatePracticeDraftSetup } = await import("./candidate-practice-draft-repository");

        await expect(updateCandidatePracticeDraftSetup({
            candidateProfileId: "profile-3",
            practiceDraftId: "draft-3",
            targetRole: "Warehouse supervisor",
            jobDescription: "",
            resumeText: "",
        })).resolves.toMatchObject({
            practiceDraftId: "draft-3",
            jobDescription: null,
            resumeContext: {
                pastedText: null,
                extractedText: "",
                captureMode: "none",
                processedArtifact: null,
            },
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("where practice_draft_id = $1 and candidate_profile_id = $2"),
            expect.arrayContaining(["draft-3", "profile-3", "Warehouse supervisor", null]),
        );
    });

    it("updates structured intake responses while preserving candidate ownership", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [practiceDraftRow({
                practice_draft_id: "draft-intake",
                candidate_profile_id: "profile-intake",
                target_role: "Program coordinator",
                intake_responses_json: {
                    confidenceLevel: "medium",
                    interviewType: "behavioral",
                    timeline: "Interview next week",
                    concerns: "Staying concise",
                    practiceFocus: ["structure", "specific examples"],
                },
            })],
        });

        const { updateCandidatePracticeDraftIntake } = await import("./candidate-practice-draft-repository");

        await expect(updateCandidatePracticeDraftIntake({
            candidateProfileId: "profile-intake",
            practiceDraftId: "draft-intake",
            intakeResponses: {
                confidenceLevel: "medium",
                interviewType: "behavioral",
                timeline: " Interview next week ",
                concerns: " Staying concise ",
                practiceFocus: [" structure ", "", "specific examples", "structure"],
            },
        })).resolves.toMatchObject({
            practiceDraftId: "draft-intake",
            intakeResponses: {
                confidenceLevel: "medium",
                interviewType: "behavioral",
                timeline: "Interview next week",
                concerns: "Staying concise",
                practiceFocus: ["structure", "specific examples"],
            },
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("intake_responses_json = $3"),
            [
                "draft-intake",
                "profile-intake",
                {
                    confidenceLevel: "medium",
                    interviewType: "behavioral",
                    timeline: "Interview next week",
                    concerns: "Staying concise",
                    practiceFocus: ["structure", "specific examples"],
                },
            ],
        );
        expect(queryPostgresMock.mock.calls[0][0]).toContain("where practice_draft_id = $1 and candidate_profile_id = $2 and status = 'draft'");
    });

    it("attaches pending private resume upload metadata to an editable candidate draft", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [practiceDraftRow({
                practice_draft_id: "draft-upload",
                candidate_profile_id: "profile-upload",
                target_role: "Data analyst",
                resume_context_json: {
                    pastedText: null,
                    extractedText: "",
                    captureMode: "file_upload",
                    sourceAssets: [{
                        assetId: "asset-1",
                        kind: "file",
                        fileName: "resume.pdf",
                        mimeType: "application/pdf",
                        byteSize: 240_000,
                        storagePath: "candidate-resume-uploads/asset-1/resume.pdf",
                        status: "pending_extraction",
                        retention: "processing_only",
                    }],
                    processedArtifact: null,
                },
            })],
        });

        const { attachPendingResumeUploadToCandidatePracticeDraft } = await import("./candidate-practice-draft-repository");

        await expect(attachPendingResumeUploadToCandidatePracticeDraft({
            candidateProfileId: "profile-upload",
            practiceDraftId: "draft-upload",
            assetId: "asset-1",
            fileName: " resume.pdf ",
            mimeType: "application/pdf",
            byteSize: 240_000,
            storagePath: "candidate-resume-uploads/asset-1/resume.pdf",
        })).resolves.toMatchObject({
            practiceDraftId: "draft-upload",
            resumeContext: {
                pastedText: null,
                extractedText: "",
                captureMode: "file_upload",
                sourceAssets: [{
                    assetId: "asset-1",
                    kind: "file",
                    fileName: "resume.pdf",
                    mimeType: "application/pdf",
                    byteSize: 240_000,
                    storagePath: "candidate-resume-uploads/asset-1/resume.pdf",
                    status: "pending_extraction",
                    retention: "processing_only",
                }],
                processedArtifact: null,
            },
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("resume_context_json = $3"),
            [
                "draft-upload",
                "profile-upload",
                expect.objectContaining({
                    captureMode: "file_upload",
                    sourceAssets: [expect.objectContaining({
                        storagePath: "candidate-resume-uploads/asset-1/resume.pdf",
                        status: "pending_extraction",
                    })],
                    processedArtifact: null,
                }),
            ],
        );
        expect(queryPostgresMock.mock.calls[0][0]).toContain("where practice_draft_id = $1 and candidate_profile_id = $2 and status = 'draft'");
    });

    it("rejects unsafe pending resume upload storage paths before writing metadata", async () => {
        const { attachPendingResumeUploadToCandidatePracticeDraft } = await import("./candidate-practice-draft-repository");

        await expect(attachPendingResumeUploadToCandidatePracticeDraft({
            candidateProfileId: "profile-upload",
            practiceDraftId: "draft-upload",
            assetId: "asset-1",
            fileName: "resume.pdf",
            mimeType: "application/pdf",
            byteSize: 240_000,
            storagePath: "https://storage.example/resume.pdf",
        })).rejects.toThrow("Resume upload storage path must be a private candidate resume upload path.");

        expect(queryPostgresMock).not.toHaveBeenCalled();
    });

    it("completes file upload extraction into normalized processed resume context", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [practiceDraftRow({
                practice_draft_id: "draft-upload",
                candidate_profile_id: "profile-upload",
                target_role: "Data analyst",
                resume_context_json: {
                    pastedText: null,
                    extractedText: "Built weekly forecast dashboards.",
                    captureMode: "file_upload",
                    sourceAssets: [{
                        assetId: "asset-1",
                        kind: "file",
                        fileName: "resume.pdf",
                        mimeType: "application/pdf",
                        byteSize: 240_000,
                        storagePath: "candidate-resume-uploads/asset-1/resume.pdf",
                        status: "extracted",
                        retention: "original_deleted",
                    }],
                    processedArtifact: {
                        text: "Built weekly forecast dashboards.",
                        source: "file_upload",
                        originalRetained: false,
                    },
                },
            })],
        });

        const { completeResumeUploadExtractionForCandidatePracticeDraft } = await import("./candidate-practice-draft-repository");

        await expect(completeResumeUploadExtractionForCandidatePracticeDraft({
            candidateProfileId: "profile-upload",
            practiceDraftId: "draft-upload",
            assetId: "asset-1",
            extractedText: " Built\tweekly forecast dashboards. ",
        })).resolves.toMatchObject({
            practiceDraftId: "draft-upload",
            resumeContext: {
                pastedText: null,
                extractedText: "Built weekly forecast dashboards.",
                captureMode: "file_upload",
                sourceAssets: [{
                    assetId: "asset-1",
                    status: "extracted",
                    retention: "original_deleted",
                }],
                processedArtifact: {
                    text: "Built weekly forecast dashboards.",
                    source: "file_upload",
                    originalRetained: false,
                },
            },
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("resume_context_json = jsonb_set"),
            [
                "draft-upload",
                "profile-upload",
                "asset-1",
                "Built weekly forecast dashboards.",
                expect.objectContaining({
                    text: "Built weekly forecast dashboards.",
                    source: "file_upload",
                    originalRetained: false,
                }),
            ],
        );
        expect(queryPostgresMock.mock.calls[0][0]).toContain("candidate_profile_id = $2");
        expect(queryPostgresMock.mock.calls[0][0]).toContain("status = 'draft'");
        expect(queryPostgresMock.mock.calls[0][0]).not.toContain("storage_path");
    });

    it("marks file upload extraction failures with a safe reason code only", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [practiceDraftRow({
                practice_draft_id: "draft-upload",
                candidate_profile_id: "profile-upload",
                resume_context_json: {
                    pastedText: null,
                    extractedText: "",
                    captureMode: "file_upload",
                    sourceAssets: [{
                        assetId: "asset-1",
                        kind: "file",
                        fileName: "resume.pdf",
                        mimeType: "application/pdf",
                        byteSize: 240_000,
                        storagePath: "candidate-resume-uploads/asset-1/resume.pdf",
                        status: "extraction_failed",
                        retention: "processing_only",
                        failureCode: "UNREADABLE_DOCUMENT",
                    }],
                    processedArtifact: null,
                },
            })],
        });

        const { markResumeUploadExtractionFailedForCandidatePracticeDraft } = await import("./candidate-practice-draft-repository");

        await expect(markResumeUploadExtractionFailedForCandidatePracticeDraft({
            candidateProfileId: "profile-upload",
            practiceDraftId: "draft-upload",
            assetId: "asset-1",
            errorCode: " unreadable document: C:\\Users\\fusbo\\resume.pdf contains raw text ",
        })).resolves.toMatchObject({
            resumeContext: {
                sourceAssets: [{
                    assetId: "asset-1",
                    status: "extraction_failed",
                    retention: "processing_only",
                    failureCode: "UNREADABLE_DOCUMENT",
                }],
                processedArtifact: null,
            },
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("failureCode"),
            ["draft-upload", "profile-upload", "asset-1", "UNREADABLE_DOCUMENT"],
        );
        expect(queryPostgresMock.mock.calls[0][1]).not.toContain("C:\\Users\\fusbo\\resume.pdf");
    });

    it("normalizes legacy resume context into a processed artifact without raw-file retention", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [practiceDraftRow({
                practice_draft_id: "draft-legacy",
                candidate_profile_id: "profile-legacy",
                target_role: "Program coordinator",
                resume_context_json: {
                    pastedText: "Legacy normalized text",
                    extractedText: "Legacy normalized text",
                    captureMode: "pasted_text",
                },
            })],
        });

        const { findCandidatePracticeDraftById } = await import("./candidate-practice-draft-repository");

        await expect(findCandidatePracticeDraftById({
            candidateProfileId: "profile-legacy",
            practiceDraftId: "draft-legacy",
        })).resolves.toMatchObject({
            resumeContext: {
                pastedText: "Legacy normalized text",
                extractedText: "Legacy normalized text",
                captureMode: "pasted_text",
                processedArtifact: {
                    text: "Legacy normalized text",
                    source: "pasted_text",
                    originalRetained: false,
                },
            },
        });
    });

    it("transitions an editable draft into generation state through candidate ownership", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [practiceDraftRow({
                practice_draft_id: "draft-4",
                candidate_profile_id: "profile-4",
                status: "generating",
                resume_target_screen: "practice_generating",
                generation_started_at: "2026-05-12T11:00:00.000Z",
                generation_error: null,
            })],
        });

        const { transitionCandidatePracticeDraftToGenerating } = await import("./candidate-practice-draft-repository");

        await expect(transitionCandidatePracticeDraftToGenerating({
            candidateProfileId: "profile-4",
            practiceDraftId: "draft-4",
        })).resolves.toMatchObject({
            practiceDraftId: "draft-4",
            candidateProfileId: "profile-4",
            status: "generating",
            resumeTargetScreen: "practice_generating",
            generationStartedAt: "2026-05-12T11:00:00.000Z",
            generationError: null,
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("status = 'generating'"),
            ["draft-4", "profile-4"],
        );
        expect(queryPostgresMock.mock.calls[0][0]).toContain("resume_target_screen = 'practice_generating'");
        expect(queryPostgresMock.mock.calls[0][0]).toContain("where practice_draft_id = $1 and candidate_profile_id = $2 and status = 'draft'");
    });

    it("attaches a generated session to a generating draft through candidate ownership", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [practiceDraftRow({
                practice_draft_id: "draft-5",
                candidate_profile_id: "profile-5",
                status: "ready",
                session_id: "11111111-1111-4111-8111-111111111111",
                question_set_snapshot_id: "22222222-2222-4222-8222-222222222222",
                resume_target_screen: "session_entry",
                generation_finished_at: "2026-05-12T11:30:00.000Z",
            })],
        });

        const { attachGeneratedSessionToCandidatePracticeDraft } = await import("./candidate-practice-draft-repository");

        await expect(attachGeneratedSessionToCandidatePracticeDraft({
            candidateProfileId: "profile-5",
            practiceDraftId: "draft-5",
            sessionId: "11111111-1111-4111-8111-111111111111",
            questionSetSnapshotId: "22222222-2222-4222-8222-222222222222",
        })).resolves.toMatchObject({
            practiceDraftId: "draft-5",
            candidateProfileId: "profile-5",
            status: "ready",
            sessionId: "11111111-1111-4111-8111-111111111111",
            questionSetSnapshotId: "22222222-2222-4222-8222-222222222222",
            resumeTargetScreen: "session_entry",
            generationFinishedAt: "2026-05-12T11:30:00.000Z",
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("session_id = $3"),
            [
                "draft-5",
                "profile-5",
                "11111111-1111-4111-8111-111111111111",
                "22222222-2222-4222-8222-222222222222",
            ],
        );
        expect(queryPostgresMock.mock.calls[0][0]).toContain("status = 'ready'");
        expect(queryPostgresMock.mock.calls[0][0]).toContain("resume_target_screen = 'session_entry'");
        expect(queryPostgresMock.mock.calls[0][0]).toContain("where practice_draft_id = $1 and candidate_profile_id = $2 and status = 'generating'");
    });

    it("updates draft progress target by session through candidate ownership", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [practiceDraftRow({
                practice_draft_id: "draft-6",
                candidate_profile_id: "profile-6",
                status: "in_session",
                session_id: "11111111-1111-4111-8111-111111111111",
                resume_target_screen: "session_in_progress",
            })],
        });

        const { updateCandidatePracticeDraftProgressBySessionId } = await import("./candidate-practice-draft-repository");

        await expect(updateCandidatePracticeDraftProgressBySessionId({
            candidateProfileId: "profile-6",
            sessionId: "11111111-1111-4111-8111-111111111111",
            status: "in_session",
            resumeTargetScreen: "session_in_progress",
        })).resolves.toMatchObject({
            practiceDraftId: "draft-6",
            status: "in_session",
            resumeTargetScreen: "session_in_progress",
        });

        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("where session_id = $1 and candidate_profile_id = $2"),
            [
                "11111111-1111-4111-8111-111111111111",
                "profile-6",
                "in_session",
                "session_in_progress",
            ],
        );
        expect(queryPostgresMock.mock.calls[0][0]).toContain("status = $3");
        expect(queryPostgresMock.mock.calls[0][0]).toContain("resume_target_screen = $4");
    });
});

function practiceDraftRow(overrides: Record<string, unknown>) {
    return {
        practice_draft_id: "draft-id",
        candidate_profile_id: "profile-id",
        status: "draft",
        target_role: "Target role",
        job_description: null,
        resume_context_json: { pastedText: null, extractedText: "", captureMode: "none" },
        custom_questions_json: [],
        intake_responses_json: {
            confidenceLevel: null,
            interviewType: null,
            timeline: null,
            concerns: null,
            practiceFocus: [],
        },
        question_set_snapshot_id: null,
        session_id: null,
        resume_target_screen: "practice_setup",
        generation_started_at: null,
        generation_finished_at: null,
        generation_error: null,
        last_activity_at: "2026-05-12T10:00:00.000Z",
        created_at: "2026-05-12T10:00:00.000Z",
        updated_at: "2026-05-12T10:00:00.000Z",
        ...overrides,
    };
}
