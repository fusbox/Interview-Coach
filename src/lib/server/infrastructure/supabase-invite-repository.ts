import { Invite, InviteRepository } from "@/lib/domain/invite";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/server/crypto";
import { encrypt } from "@/lib/server/encryption";
import { Logger } from "@/lib/logger";
import type {
    CreateInviteBatchInput,
    InviteBatchFailure,
    PersistedInviteBatch,
    PersistedInviteBatchCandidate,
} from "@/lib/server/application/invites/types";
import { randomUUID } from "crypto";

import { SupabaseClient } from "@supabase/supabase-js";

export class SupabaseInviteRepository implements InviteRepository {
    async create(invite: Invite, client?: SupabaseClient): Promise<void> {
        const supabase = client || createClient();

        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .insert({
                session_id: invite.id,
                recruiter_id: invite.createdBy,
                target_role: invite.role,
                job_description: invite.jobDescription,
                status: 'NOT_STARTED',
                intake_json: {
                    candidate: invite.candidate,
                    invite_token: encrypt(invite.token)
                }
            })
            .select('session_id')
            .single();

        if (sessionError) {
            throw new Error(`Supabase Session Create Error: ${sessionError.message}`);
        }

        if (invite.questions && invite.questions.length > 0) {
            const qRows = invite.questions.map(q => ({
                session_id: invite.id,
                question_index: q.index,
                question_text: q.text,
                category: q.category
            }));

            const { error: qError } = await supabase.from('questions').insert(qRows);
            if (qError) throw new Error(`Supabase Questions Create Error: ${qError.message}`);
        }

        const tokenHash = hashToken(invite.token);

        const { error: tokenError } = await supabase
            .from('candidate_tokens')
            .insert({
                token_hash: tokenHash,
                session_id: sessionData.session_id
            });

        if (tokenError) {
            throw new Error(`Supabase Token Create Error: ${tokenError.message}`);
        }
    }

    async createBatch(invites: Invite[]): Promise<void> {
        const supabase = createAdminClient();
        const payload = invites.map((invite) => ({
            session_id: invite.id,
            created_by: invite.createdBy,
            role: invite.role,
            job_description: invite.jobDescription ?? null,
            candidate: invite.candidate,
            questions: invite.questions,
            token_hash: hashToken(invite.token),
            encrypted_token: encrypt(invite.token)
        }));

        const { error } = await supabase.rpc("create_invite_batch", {
            p_invites: payload
        });

        if (error) {
            throw new Error(`Supabase Invite Batch Create Error: ${error.message}`);
        }
    }

    async createTrackedBatch(input: CreateInviteBatchInput, invites: Invite[]): Promise<string> {
        const supabase = createAdminClient();
        const batchId = randomUUID();

        const { error: batchError } = await supabase.from("invite_batches").insert({
            batch_id: batchId,
            parent_batch_id: input.parentBatchId ?? null,
            created_by: input.createdBy,
            role: input.role,
            job_description: input.jobDescription ?? null,
            questions_json: input.questions,
            status: "pending",
            requested_count: input.candidates.length,
            succeeded_count: 0,
            failed_count: 0
        });

        if (batchError) {
            throw new Error(`Supabase Invite Batch Track Create Error: ${batchError.message}`);
        }

        const candidateRows = invites.map((invite, index) => ({
            batch_id: batchId,
            candidate_index: index,
            first_name: invite.candidate.firstName,
            last_name: invite.candidate.lastName,
            email: invite.candidate.email,
            req_id: invite.candidate.reqId,
            resume_text: invite.candidate.resumeText ?? null,
            status: "pending",
            retryable: true,
            retry_count: 0,
            session_id: null,
            error_code: null,
            error_message: null
        }));

        const { error: candidatesError } = await supabase.from("invite_batch_candidates").insert(candidateRows);
        if (candidatesError) {
            throw new Error(`Supabase Invite Batch Candidate Track Create Error: ${candidatesError.message}`);
        }

        return batchId;
    }

    async markTrackedBatchCompleted(batchId: string, invites: Invite[]): Promise<void> {
        const supabase = createAdminClient();
        const { error: batchError } = await supabase
            .from("invite_batches")
            .update({
                status: "completed",
                succeeded_count: invites.length,
                failed_count: 0,
                updated_at: new Date().toISOString()
            })
            .eq("batch_id", batchId);

        if (batchError) {
            throw new Error(`Supabase Invite Batch Completion Error: ${batchError.message}`);
        }

        for (let index = 0; index < invites.length; index += 1) {
            const invite = invites[index];
            const { error } = await supabase
                .from("invite_batch_candidates")
                .update({
                    status: "created",
                    retryable: false,
                    session_id: invite.id,
                    error_code: null,
                    error_message: null,
                    updated_at: new Date().toISOString()
                })
                .eq("batch_id", batchId)
                .eq("candidate_index", index);

            if (error) {
                throw new Error(`Supabase Invite Batch Candidate Completion Error: ${error.message}`);
            }
        }
    }

    async markTrackedBatchFailed(batchId: string, failures: InviteBatchFailure[]): Promise<void> {
        const supabase = createAdminClient();
        const { error: batchError } = await supabase
            .from("invite_batches")
            .update({
                status: "failed",
                succeeded_count: 0,
                failed_count: failures.length,
                updated_at: new Date().toISOString()
            })
            .eq("batch_id", batchId);

        if (batchError) {
            throw new Error(`Supabase Invite Batch Failure Track Error: ${batchError.message}`);
        }

        for (let index = 0; index < failures.length; index += 1) {
            const failure = failures[index];
            const { error } = await supabase
                .from("invite_batch_candidates")
                .update({
                    status: "failed",
                    retryable: failure.retryable,
                    error_code: failure.code,
                    error_message: failure.message,
                    updated_at: new Date().toISOString()
                })
                .eq("batch_id", batchId)
                .eq("candidate_index", index);

            if (error) {
                throw new Error(`Supabase Invite Batch Candidate Failure Track Error: ${error.message}`);
            }
        }
    }

    async getTrackedBatch(batchId: string, actorId: string): Promise<PersistedInviteBatch | null> {
        const supabase = createAdminClient();
        const { data: batch, error: batchError } = await supabase
            .from("invite_batches")
            .select("batch_id, parent_batch_id, created_by, role, job_description, questions_json, status")
            .eq("batch_id", batchId)
            .eq("created_by", actorId)
            .single();

        if (batchError || !batch) {
            return null;
        }

        const { data: candidates, error: candidatesError } = await supabase
            .from("invite_batch_candidates")
            .select("candidate_index, first_name, last_name, email, req_id, resume_text, status, retryable, retry_count, session_id, error_code, error_message")
            .eq("batch_id", batchId)
            .order("candidate_index", { ascending: true });

        if (candidatesError) {
            throw new Error(`Supabase Invite Batch Candidate Lookup Error: ${candidatesError.message}`);
        }

        const mappedCandidates: PersistedInviteBatchCandidate[] = (candidates || []).map((candidate) => ({
            candidateIndex: candidate.candidate_index,
            firstName: candidate.first_name,
            lastName: candidate.last_name,
            email: candidate.email,
            reqId: candidate.req_id,
            resumeText: candidate.resume_text ?? undefined,
            status: candidate.status,
            retryable: candidate.retryable,
            retryCount: candidate.retry_count,
            sessionId: candidate.session_id ?? undefined,
            errorCode: candidate.error_code ?? undefined,
            errorMessage: candidate.error_message ?? undefined
        }));

        return {
            batchId: batch.batch_id,
            parentBatchId: batch.parent_batch_id ?? undefined,
            createdBy: batch.created_by,
            role: batch.role,
            jobDescription: batch.job_description ?? undefined,
            questions: Array.isArray(batch.questions_json) ? batch.questions_json : [],
            status: batch.status,
            candidates: mappedCandidates
        };
    }

    async markTrackedBatchRetried(batchId: string, childBatchId: string): Promise<void> {
        const supabase = createAdminClient();
        const { error: batchError } = await supabase
            .from("invite_batches")
            .update({
                status: "retry_issued",
                updated_at: new Date().toISOString(),
                last_retry_batch_id: childBatchId
            })
            .eq("batch_id", batchId);

        if (batchError) {
            throw new Error(`Supabase Invite Batch Retry Mark Error: ${batchError.message}`);
        }

        const { data: candidates, error: candidateLookupError } = await supabase
            .from("invite_batch_candidates")
            .select("batch_candidate_id, retry_count")
            .eq("batch_id", batchId)
            .eq("status", "failed")
            .eq("retryable", true);

        if (candidateLookupError) {
            throw new Error(`Supabase Invite Batch Retry Candidate Lookup Error: ${candidateLookupError.message}`);
        }

        for (const candidate of candidates || []) {
            const { error } = await supabase
                .from("invite_batch_candidates")
                .update({
                    status: "retry_issued",
                    retryable: false,
                    retry_count: (candidate.retry_count ?? 0) + 1,
                    updated_at: new Date().toISOString()
                })
                .eq("batch_candidate_id", candidate.batch_candidate_id);

            if (error) {
                throw new Error(`Supabase Invite Batch Retry Candidate Update Error: ${error.message}`);
            }
        }
    }

    async getByToken(token: string): Promise<Invite | null> {
        const supabase = createClient();
        const tokenHash = hashToken(token);

        const { data: tokenData, error: tokenError } = await supabase
            .from('candidate_tokens')
            .select('session_id')
            .eq('token_hash', tokenHash)
            .single();

        if (tokenError || !tokenData) {
            return null;
        }
        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select('session_id, target_role, job_description, recruiter_id, created_at, intake_json')
            .eq('session_id', tokenData.session_id)
            .single();

        if (sessionError || !sessionData) {
            Logger.error("Invite session lookup failed", {
                error: sessionError,
                errorCode: "INVITE_SESSION_LOOKUP_FAILED"
            }, "InviteRepository");
            return null;
        }

        const data = { sessions: sessionData };

        interface SessionRow {
            session_id: string;
            target_role: string;
            job_description?: string;
            recruiter_id: string;
            created_at: string;
            intake_json?: {
                candidate?: {
                    firstName?: string;
                    lastName?: string;
                    name?: string;
                    email?: string;
                    reqId?: string;
                    resumeText?: string;
                };
            };
        }

        interface QuestionRow {
            question_text: string;
            question_index: number;
            category?: string;
            competencies?: { category?: string };
        }

        const session = data.sessions as SessionRow;

        const { data: qData } = await supabase
            .from('questions')
            .select('*')
            .eq('session_id', session.session_id)
            .order('question_index');

        const questions = (qData || []).map((q: QuestionRow) => ({
            text: q.question_text,
            index: q.question_index,
            category: q.category || q.competencies?.category || "General"
        }));

        const rawCandidate = session.intake_json?.candidate || {};
        const candidate = {
            firstName: rawCandidate.firstName || rawCandidate.name?.split(' ')[0] || "",
            lastName: rawCandidate.lastName || rawCandidate.name?.split(' ').slice(1).join(' ') || "",
            email: rawCandidate.email || "",
            reqId: rawCandidate.reqId || "",
            resumeText: rawCandidate.resumeText || undefined
        };

        return {
            id: session.session_id,
            token: token,
            role: session.target_role,
            jobDescription: session.job_description,
            candidate: candidate,
            questions: questions,
            createdBy: session.recruiter_id,
            createdAt: new Date(session.created_at).getTime()
        };
    }
}
