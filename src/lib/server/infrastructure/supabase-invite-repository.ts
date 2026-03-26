import { Invite, InviteRepository } from "@/lib/domain/invite";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/server/crypto";
import { encrypt } from "@/lib/server/encryption";
import { Logger } from "@/lib/logger";

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
