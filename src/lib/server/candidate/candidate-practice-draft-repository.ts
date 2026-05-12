import type { QueryResultRow } from "pg";

import { safeParsePracticeSetupInput } from "@/features/practice-setup/practice-setup-schema";
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
    pastedText: string | null;
    extractedText: string;
    captureMode: "none" | "pasted_text" | "file_upload" | "image_capture" | "mixed";
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

export type UpdateCandidatePracticeDraftSetupInput = CandidatePracticeDraftLookup & {
    targetRole: string;
    jobDescription?: string | null;
    resumeText?: string | null;
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
    if (!resumeText) {
        return {
            pastedText: null,
            extractedText: "",
            captureMode: "none",
        };
    }

    return {
        pastedText: resumeText,
        extractedText: resumeText,
        captureMode: "pasted_text",
    };
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
        pastedText: typeof record.pastedText === "string" ? record.pastedText : null,
        extractedText: typeof record.extractedText === "string" ? record.extractedText : "",
        captureMode,
    };
}

function formatTimestamp(value: string | Date | null): string | null {
    if (!value) {
        return null;
    }

    return value instanceof Date ? value.toISOString() : value;
}
