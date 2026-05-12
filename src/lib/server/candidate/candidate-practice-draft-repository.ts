import type { QueryResultRow } from "pg";

import { safeParsePracticeSetupInput } from "@/features/practice-setup/practice-setup-schema";
import { normalizeResumeText } from "@/lib/candidate/resume-normalization";
import { queryPostgres } from "@/lib/server/db/postgres";

export type PracticeSessionDraftStatus =
    | "draft"
    | "generating"
    | "ready"
    | "in_session"
    | "completed"
    | "generation_failed";

export type PracticeResumeTarget =
    | "practice_setup"
    | "practice_generating"
    | "session_entry"
    | "session_in_progress"
    | "session_summary"
    | "dashboard";

export type ResumeContextSnapshot = {
    sourceAssets: ResumeSourceAsset[];
    pastedText: string | null;
    extractedText: string;
    captureMode: "none" | "pasted_text" | "file_upload" | "image_capture" | "mixed";
    processedArtifact: ProcessedResumeArtifact | null;
};

export type ResumeSourceAsset = {
    assetId: string;
    kind: "file";
    fileName: string;
    mimeType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    byteSize: number;
    storagePath: string;
    status: "pending_extraction";
    retention: "processing_only";
};

export type ProcessedResumeArtifact = {
    text: string;
    source: ResumeContextSnapshot["captureMode"];
    originalRetained: false;
};

export type CandidatePracticeDraft = {
    practiceDraftId: string;
    candidateProfileId: string;
    status: PracticeSessionDraftStatus;
    targetRole: string;
    jobDescription: string | null;
    resumeContext: ResumeContextSnapshot;
    customQuestions: unknown[];
    intakeResponses: unknown[];
    questionSetSnapshotId: string | null;
    sessionId: string | null;
    resumeTargetScreen: PracticeResumeTarget;
    generationStartedAt: string | null;
    generationFinishedAt: string | null;
    generationError: string | null;
    lastActivityAt: string;
    createdAt: string;
    updatedAt: string;
};

export type CreateCandidatePracticeDraftInput = {
    candidateProfileId: string;
    targetRole: string;
    jobDescription?: string | null;
    resumeText?: string | null;
};

export type CandidatePracticeDraftLookup = {
    candidateProfileId: string;
    practiceDraftId: string;
};

export type CandidatePracticeDraftSessionLookup = {
    candidateProfileId: string;
    sessionId: string;
};

export type UpdateCandidatePracticeDraftSetupInput = CandidatePracticeDraftLookup & {
    targetRole: string;
    jobDescription?: string | null;
    resumeText?: string | null;
};

export type AttachPendingResumeUploadToCandidatePracticeDraftInput = CandidatePracticeDraftLookup & {
    assetId: string;
    fileName: string;
    mimeType: ResumeSourceAsset["mimeType"];
    byteSize: number;
    storagePath: string;
};

export type AttachGeneratedSessionToCandidatePracticeDraftInput = CandidatePracticeDraftLookup & {
    sessionId: string;
    questionSetSnapshotId: string;
};

export type UpdateCandidatePracticeDraftProgressBySessionIdInput = CandidatePracticeDraftSessionLookup & {
    status: Extract<PracticeSessionDraftStatus, "in_session" | "completed">;
    resumeTargetScreen: Extract<PracticeResumeTarget, "session_in_progress" | "session_summary">;
};

type CandidatePracticeDraftRow = QueryResultRow & {
    practice_draft_id: string;
    candidate_profile_id: string;
    status: PracticeSessionDraftStatus;
    target_role: string;
    job_description: string | null;
    resume_context_json: unknown;
    custom_questions_json: unknown;
    intake_responses_json: unknown;
    question_set_snapshot_id: string | null;
    session_id: string | null;
    resume_target_screen: PracticeResumeTarget;
    generation_started_at: string | null;
    generation_finished_at: string | null;
    generation_error: string | null;
    last_activity_at: string | Date;
    created_at: string | Date;
    updated_at: string | Date;
};

const draftSelect = `
    practice_draft_id,
    candidate_profile_id,
    status,
    target_role,
    job_description,
    resume_context_json,
    custom_questions_json,
    intake_responses_json,
    question_set_snapshot_id,
    session_id,
    resume_target_screen,
    generation_started_at,
    generation_finished_at,
    generation_error,
    last_activity_at,
    created_at,
    updated_at
`;

export async function createCandidatePracticeDraft(input: CreateCandidatePracticeDraftInput): Promise<CandidatePracticeDraft> {
    const candidateProfileId = normalizeId(input.candidateProfileId, "Candidate profile ID");
    const setup = normalizeSetupInput(input);
    const resumeContext = buildResumeContext(setup.resumeText);

    const result = await queryPostgres<CandidatePracticeDraftRow>(
        `
            insert into public.candidate_practice_drafts (
                candidate_profile_id,
                target_role,
                job_description,
                resume_context_json,
                custom_questions_json,
                intake_responses_json,
                resume_target_screen,
                last_activity_at
            )
            values ($1, $2, $3, $4, '[]'::jsonb, '[]'::jsonb, 'practice_setup', now())
            returning ${draftSelect}
        `,
        [candidateProfileId, setup.targetRole, setup.jobDescription, resumeContext],
    );

    return mapCandidatePracticeDraftRow(result.rows[0]);
}

export async function findCandidatePracticeDraftById(input: CandidatePracticeDraftLookup): Promise<CandidatePracticeDraft | null> {
    const practiceDraftId = normalizeId(input.practiceDraftId, "Practice draft ID");
    const candidateProfileId = normalizeId(input.candidateProfileId, "Candidate profile ID");

    const result = await queryPostgres<CandidatePracticeDraftRow>(
        `
            select ${draftSelect}
            from public.candidate_practice_drafts
            where practice_draft_id = $1 and candidate_profile_id = $2
            limit 1
        `,
        [practiceDraftId, candidateProfileId],
    );

    return result.rows[0] ? mapCandidatePracticeDraftRow(result.rows[0]) : null;
}

export async function findCandidatePracticeDraftBySessionId(input: CandidatePracticeDraftSessionLookup): Promise<CandidatePracticeDraft | null> {
    const sessionId = normalizeId(input.sessionId, "Session ID");
    const candidateProfileId = normalizeId(input.candidateProfileId, "Candidate profile ID");

    const result = await queryPostgres<CandidatePracticeDraftRow>(
        `
            select ${draftSelect}
            from public.candidate_practice_drafts
            where session_id = $1 and candidate_profile_id = $2
            limit 1
        `,
        [sessionId, candidateProfileId],
    );

    return result.rows[0] ? mapCandidatePracticeDraftRow(result.rows[0]) : null;
}

export async function findLatestEditableCandidatePracticeDraft(candidateProfileId: string): Promise<CandidatePracticeDraft | null> {
    const normalizedCandidateProfileId = normalizeId(candidateProfileId, "Candidate profile ID");

    const result = await queryPostgres<CandidatePracticeDraftRow>(
        `
            select ${draftSelect}
            from public.candidate_practice_drafts
            where candidate_profile_id = $1 and status = 'draft'
            order by last_activity_at desc
            limit 1
        `,
        [normalizedCandidateProfileId],
    );

    return result.rows[0] ? mapCandidatePracticeDraftRow(result.rows[0]) : null;
}

export async function updateCandidatePracticeDraftSetup(input: UpdateCandidatePracticeDraftSetupInput): Promise<CandidatePracticeDraft | null> {
    const practiceDraftId = normalizeId(input.practiceDraftId, "Practice draft ID");
    const candidateProfileId = normalizeId(input.candidateProfileId, "Candidate profile ID");
    const setup = normalizeSetupInput(input);
    const resumeContext = buildResumeContext(setup.resumeText);

    const result = await queryPostgres<CandidatePracticeDraftRow>(
        `
            update public.candidate_practice_drafts
            set
                target_role = $3,
                job_description = $4,
                resume_context_json = $5,
                resume_target_screen = 'practice_setup',
                last_activity_at = now()
            where practice_draft_id = $1 and candidate_profile_id = $2 and status = 'draft'
            returning ${draftSelect}
        `,
        [practiceDraftId, candidateProfileId, setup.targetRole, setup.jobDescription, resumeContext],
    );

    return result.rows[0] ? mapCandidatePracticeDraftRow(result.rows[0]) : null;
}

export async function attachPendingResumeUploadToCandidatePracticeDraft(
    input: AttachPendingResumeUploadToCandidatePracticeDraftInput,
): Promise<CandidatePracticeDraft | null> {
    const practiceDraftId = normalizeId(input.practiceDraftId, "Practice draft ID");
    const candidateProfileId = normalizeId(input.candidateProfileId, "Candidate profile ID");
    const resumeContext = buildPendingResumeUploadContext(input);

    const result = await queryPostgres<CandidatePracticeDraftRow>(
        `
            update public.candidate_practice_drafts
            set
                resume_context_json = $3,
                resume_target_screen = 'practice_setup',
                last_activity_at = now()
            where practice_draft_id = $1 and candidate_profile_id = $2 and status = 'draft'
            returning ${draftSelect}
        `,
        [practiceDraftId, candidateProfileId, resumeContext],
    );

    return result.rows[0] ? mapCandidatePracticeDraftRow(result.rows[0]) : null;
}

export async function transitionCandidatePracticeDraftToGenerating(input: CandidatePracticeDraftLookup): Promise<CandidatePracticeDraft | null> {
    const practiceDraftId = normalizeId(input.practiceDraftId, "Practice draft ID");
    const candidateProfileId = normalizeId(input.candidateProfileId, "Candidate profile ID");

    const result = await queryPostgres<CandidatePracticeDraftRow>(
        `
            update public.candidate_practice_drafts
            set
                status = 'generating',
                resume_target_screen = 'practice_generating',
                generation_started_at = now(),
                generation_finished_at = null,
                generation_error = null,
                last_activity_at = now()
            where practice_draft_id = $1 and candidate_profile_id = $2 and status = 'draft'
            returning ${draftSelect}
        `,
        [practiceDraftId, candidateProfileId],
    );

    return result.rows[0] ? mapCandidatePracticeDraftRow(result.rows[0]) : null;
}

export async function attachGeneratedSessionToCandidatePracticeDraft(
    input: AttachGeneratedSessionToCandidatePracticeDraftInput,
): Promise<CandidatePracticeDraft | null> {
    const practiceDraftId = normalizeId(input.practiceDraftId, "Practice draft ID");
    const candidateProfileId = normalizeId(input.candidateProfileId, "Candidate profile ID");
    const sessionId = normalizeId(input.sessionId, "Session ID");
    const questionSetSnapshotId = normalizeId(input.questionSetSnapshotId, "Question set snapshot ID");

    const result = await queryPostgres<CandidatePracticeDraftRow>(
        `
            update public.candidate_practice_drafts
            set
                status = 'ready',
                session_id = $3,
                question_set_snapshot_id = $4,
                resume_target_screen = 'session_entry',
                generation_finished_at = now(),
                generation_error = null,
                last_activity_at = now()
            where practice_draft_id = $1 and candidate_profile_id = $2 and status = 'generating'
            returning ${draftSelect}
        `,
        [practiceDraftId, candidateProfileId, sessionId, questionSetSnapshotId],
    );

    return result.rows[0] ? mapCandidatePracticeDraftRow(result.rows[0]) : null;
}

export async function updateCandidatePracticeDraftProgressBySessionId(
    input: UpdateCandidatePracticeDraftProgressBySessionIdInput,
): Promise<CandidatePracticeDraft | null> {
    const sessionId = normalizeId(input.sessionId, "Session ID");
    const candidateProfileId = normalizeId(input.candidateProfileId, "Candidate profile ID");

    const result = await queryPostgres<CandidatePracticeDraftRow>(
        `
            update public.candidate_practice_drafts
            set
                status = $3,
                resume_target_screen = $4,
                last_activity_at = now()
            where session_id = $1 and candidate_profile_id = $2
            returning ${draftSelect}
        `,
        [sessionId, candidateProfileId, input.status, input.resumeTargetScreen],
    );

    return result.rows[0] ? mapCandidatePracticeDraftRow(result.rows[0]) : null;
}

function normalizeSetupInput(input: CreateCandidatePracticeDraftInput) {
    const result = safeParsePracticeSetupInput({
        targetRole: input.targetRole,
        jobDescription: input.jobDescription,
        resumeText: input.resumeText,
    });

    if (!result.success) {
        throw new Error("Invalid candidate practice draft setup input.");
    }

    return result.data;
}

function buildResumeContext(resumeText: string | null): ResumeContextSnapshot {
    const normalizedResumeText = normalizeResumeText(resumeText);

    if (!normalizedResumeText) {
        return {
            sourceAssets: [],
            pastedText: null,
            extractedText: "",
            captureMode: "none",
            processedArtifact: null,
        };
    }

    return {
        sourceAssets: [],
        pastedText: normalizedResumeText,
        extractedText: normalizedResumeText,
        captureMode: "pasted_text",
        processedArtifact: {
            text: normalizedResumeText,
            source: "pasted_text",
            originalRetained: false,
        },
    };
}

function buildPendingResumeUploadContext(input: AttachPendingResumeUploadToCandidatePracticeDraftInput): ResumeContextSnapshot {
    return {
        sourceAssets: [normalizePendingResumeUpload(input)],
        pastedText: null,
        extractedText: "",
        captureMode: "file_upload",
        processedArtifact: null,
    };
}

function normalizePendingResumeUpload(input: AttachPendingResumeUploadToCandidatePracticeDraftInput): ResumeSourceAsset {
    const assetId = normalizeId(input.assetId, "Resume asset ID");
    const fileName = normalizeFileName(input.fileName);
    const storagePath = normalizePrivateUploadStoragePath(input.storagePath);
    const byteSize = normalizeByteSize(input.byteSize);

    return {
        assetId,
        kind: "file",
        fileName,
        mimeType: normalizeResumeMimeType(input.mimeType),
        byteSize,
        storagePath,
        status: "pending_extraction",
        retention: "processing_only",
    };
}

function normalizeFileName(value: string): string {
    const fileName = normalizeId(value, "Resume file name");
    if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
        throw new Error("Resume file name must not include path segments.");
    }
    return fileName;
}

function normalizePrivateUploadStoragePath(value: string): string {
    const storagePath = normalizeId(value, "Resume upload storage path");
    if (
        !storagePath.startsWith("candidate-resume-uploads/") ||
        storagePath.startsWith("/") ||
        storagePath.includes("://") ||
        storagePath.includes("\\") ||
        storagePath.includes("..") ||
        storagePath.includes("?") ||
        storagePath.includes("#")
    ) {
        throw new Error("Resume upload storage path must be a private candidate resume upload path.");
    }
    return storagePath;
}

function normalizeByteSize(value: number): number {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error("Resume upload byte size must be a positive integer.");
    }
    return value;
}

function normalizeResumeMimeType(value: string): ResumeSourceAsset["mimeType"] {
    if (
        value !== "application/pdf" &&
        value !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
        throw new Error("Resume upload MIME type is not supported.");
    }
    return value;
}

function normalizeId(value: string, label: string): string {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error(`${label} is required.`);
    }
    return normalized;
}

function mapCandidatePracticeDraftRow(row: CandidatePracticeDraftRow): CandidatePracticeDraft {
    return {
        practiceDraftId: row.practice_draft_id,
        candidateProfileId: row.candidate_profile_id,
        status: row.status,
        targetRole: row.target_role,
        jobDescription: row.job_description,
        resumeContext: normalizeResumeContext(row.resume_context_json),
        customQuestions: Array.isArray(row.custom_questions_json) ? row.custom_questions_json : [],
        intakeResponses: Array.isArray(row.intake_responses_json) ? row.intake_responses_json : [],
        questionSetSnapshotId: row.question_set_snapshot_id,
        sessionId: row.session_id,
        resumeTargetScreen: row.resume_target_screen,
        generationStartedAt: formatTimestamp(row.generation_started_at),
        generationFinishedAt: formatTimestamp(row.generation_finished_at),
        generationError: row.generation_error,
        lastActivityAt: formatTimestamp(row.last_activity_at) ?? "",
        createdAt: formatTimestamp(row.created_at) ?? "",
        updatedAt: formatTimestamp(row.updated_at) ?? "",
    };
}

function normalizeResumeContext(value: unknown): ResumeContextSnapshot {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return buildResumeContext(null);
    }

    const record = value as Partial<ResumeContextSnapshot>;
    const captureMode = record.captureMode && ["none", "pasted_text", "file_upload", "image_capture", "mixed"].includes(record.captureMode)
        ? record.captureMode
        : "none";

    return {
        sourceAssets: normalizeSourceAssets(record.sourceAssets),
        pastedText: typeof record.pastedText === "string" ? record.pastedText : null,
        extractedText: typeof record.extractedText === "string" ? record.extractedText : "",
        captureMode,
        processedArtifact: normalizeProcessedArtifact(record, captureMode),
    };
}

function normalizeSourceAssets(value: unknown): ResumeSourceAsset[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return [];
        }

        const asset = item as Partial<ResumeSourceAsset>;
        if (
            typeof asset.assetId !== "string" ||
            typeof asset.fileName !== "string" ||
            typeof asset.mimeType !== "string" ||
            typeof asset.byteSize !== "number" ||
            typeof asset.storagePath !== "string"
        ) {
            return [];
        }

        try {
            return [normalizePendingResumeUpload({
                candidateProfileId: "normalization-only",
                practiceDraftId: "normalization-only",
                assetId: asset.assetId,
                fileName: asset.fileName,
                mimeType: asset.mimeType,
                byteSize: asset.byteSize,
                storagePath: asset.storagePath,
            })];
        } catch {
            return [];
        }
    });
}

function normalizeProcessedArtifact(
    record: Partial<ResumeContextSnapshot>,
    captureMode: ResumeContextSnapshot["captureMode"],
): ProcessedResumeArtifact | null {
    const candidateArtifact = record.processedArtifact;
    if (candidateArtifact && typeof candidateArtifact === "object") {
        const artifact = candidateArtifact as Partial<ProcessedResumeArtifact>;
        if (typeof artifact.text === "string" && artifact.text.trim()) {
            return {
                text: artifact.text,
                source: captureMode,
                originalRetained: false,
            };
        }
    }

    const fallbackText = typeof record.extractedText === "string" && record.extractedText.trim()
        ? record.extractedText
        : null;

    if (!fallbackText || captureMode === "none") {
        return null;
    }

    return {
        text: fallbackText,
        source: captureMode,
        originalRetained: false,
    };
}

function formatTimestamp(value: string | Date | null): string | null {
    if (!value) {
        return null;
    }

    return value instanceof Date ? value.toISOString() : value;
}
