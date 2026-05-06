import { SessionRepository } from "@/lib/domain/repository";
import { InterviewSession, Answer, Question, SessionSummary, SessionStatus, AnalysisResult } from "@/lib/domain/types";
import { AnalysisResultSchema } from "@/lib/domain/schemas";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { Logger } from "@/lib/logger";
import { decrypt, encrypt } from "@/lib/server/encryption";

interface SessionIntake {
    candidate?: { firstName?: string; lastName?: string; name?: string; email?: string; resumeText?: string };
    invite_token?: string;
    viewed_at?: number;
    entered_initials?: string;
    engaged_time_seconds?: number;
    retry_contexts?: Record<string, unknown>;
    summary_expires_at?: number | string | null;
}

interface DbSession {
    session_id: string;
    target_role: string;
    status: string;
    created_at: string;
    intake_json: SessionIntake | null;
    parent_session_id: string | null;
    attempt_number: number | null;
    client_name: string | null;
    invitation_sent_at: string | null;

    updated_at: string;
    questions?: { count: number }[];
    answers?: { submitted_at: string | null }[];
}

interface DbQuestion {
    question_id: string;
    session_id: string;
    question_index: number;
    question_text: string;
    category: string | null;
}

interface DbAnswer {
    question_id: string;
    session_id: string;
    final_text: string | null;
    draft_text: string | null;
    submitted_at: string | null;
    attempt_number: number;
}

interface DbEval {
    question_id: string;
    session_id: string;
    feedback_json: unknown;
    attempt_number: number;
}

export class SupabaseSessionRepository implements SessionRepository {
    private asObject(value: unknown): Record<string, unknown> {
        return value && typeof value === "object" && !Array.isArray(value)
            ? value as Record<string, unknown>
            : {};
    }

    private asString(value: unknown): string | undefined {
        return typeof value === "string" && value.trim().length > 0 ? value : undefined;
    }

    private asNumber(value: unknown): number | undefined {
        return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    }

    private asTimestamp(value: unknown): number | undefined {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === "string" && value.trim().length > 0) {
            const parsed = new Date(value).getTime();
            return Number.isFinite(parsed) ? parsed : undefined;
        }

        return undefined;
    }

    private asAttemptNumber(value: unknown): number | undefined {
        return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
    }

    private async clearExpiredSummary(sessionId: string, intake: SessionIntake | null | undefined): Promise<void> {
        const supabase = createAdminClient();
        const updatedIntake = { ...(intake || {}) };
        delete updatedIntake.summary_expires_at;

        const { error } = await supabase
            .from("sessions")
            .update({
                summary_narrative: null,
                intake_json: updatedIntake
            })
            .eq("session_id", sessionId);

        if (error) {
            Logger.error("[Repo] clearExpiredSummary Failed", error);
        }
    }

    private normalizeCandidate(rawCandidate: unknown) {
        const candidate = this.asObject(rawCandidate);
        const firstName = this.asString(candidate.firstName) || "";
        const lastName = this.asString(candidate.lastName) || "";
        const fullName = this.asString(candidate.name);
        const email = this.asString(candidate.email) || "";
        const resumeText = this.asString(candidate.resumeText);

        return {
            firstName,
            lastName,
            fullName,
            email,
            resumeText
        };
    }

    private normalizeDbStatus(status: string): SessionStatus {
        if (status === "AWAITING_EVAL") {
            return "AWAITING_EVALUATION";
        }

        return status as SessionStatus;
    }

    private parseAnalysisResult(feedbackJson: unknown, sessionId: string, questionId: string): AnalysisResult | undefined {
        if (!feedbackJson) {
            return undefined;
        }

        const result = AnalysisResultSchema.safeParse(feedbackJson);
        if (!result.success) {
            Logger.warn("[Repo] Dropping invalid persisted analysis payload", {
                sessionId,
                questionId,
                issues: result.error.issues.map(issue => issue.message)
            });
            return undefined;
        }

        return result.data;
    }

    private async incrementEngagementTime(sessionId: string, deltaSeconds: number): Promise<void> {
        const supabase = createAdminClient();
        const { error } = await supabase.rpc('increment_session_engagement', {
            p_session_id: sessionId,
            p_delta_seconds: deltaSeconds
        });

        if (error) {
            Logger.error("[Repo] incrementEngagementTime Failed", error);
            throw new Error(error.message);
        }
    }

    async create(session: InterviewSession): Promise<void> {
        await this.update(session);
    }



    async listByRecruiter(recruiterId: string): Promise<SessionSummary[]> {
        const supabase = createClient();
        
        const { data: sessionsInitial, error } = await supabase
            .from('sessions')
            .select(`
                session_id,
                target_role,
                status,
                created_at,
                updated_at,
                intake_json,
                parent_session_id,
                attempt_number,
                client_name,
                questions(count),
                answers(submitted_at),
                invitation_sent_at
            `)
            .eq('recruiter_id', recruiterId)
            .or('invitation_sent_at.not.is.null,parent_session_id.not.is.null')
            .order('updated_at', { ascending: false });

        if (error) {
            Logger.error("[SupabaseSessionRepo] List Failed", error);
            throw new Error(error.message);
        }

        const sessionsFinal = (sessionsInitial as unknown as DbSession[] || []);
        return this.mapSessions(sessionsFinal);
    }

    private mapSessions(sessions: DbSession[]): SessionSummary[] {
        return sessions.map((s: DbSession) => {
            const intake = this.asObject(s.intake_json);
            const candidate = this.normalizeCandidate(intake.candidate);
            const candidateName = (candidate.firstName && candidate.lastName)
                ? `${candidate.firstName} ${candidate.lastName}`
                : (candidate.fullName || "Anonymous Candidate");

            let inviteToken: string | undefined = undefined;
            const encryptedInviteToken = this.asString(intake.invite_token);
            if (encryptedInviteToken) {
                try {
                    inviteToken = decrypt(encryptedInviteToken);
                } catch {
                    Logger.error("[Repo] Failed to decrypt invite token", { sessionId: s.session_id });
                }
            }
            const viewedAt = this.asTimestamp(intake.viewed_at);

            // Extract counts correctly from Supabase response
            const questionCount = this.asNumber(s.questions?.[0]?.count) || 0;
            const answers = s.answers || [];
            const answerCount = answers.length;
            const submittedCount = answers.filter((a: { submitted_at: string | null }) => !!a.submitted_at).length;

            // Derived Status for consistency
            let derivedStatus = this.normalizeDbStatus(s.status);
            if (s.status === 'NOT_STARTED' && answerCount > 0) {
                derivedStatus = 'IN_SESSION';
            } else if (s.status === 'IN_SESSION' && submittedCount === questionCount && questionCount > 0) {
                derivedStatus = 'COMPLETED';
            }

            return {
                id: s.session_id,
                candidateName,
                role: s.target_role,
                status: derivedStatus,
                createdAt: this.asTimestamp(s.created_at) || 0,
                updatedAt: this.asTimestamp(s.updated_at) || this.asTimestamp(s.created_at) || 0,
                questionCount,
                answerCount,
                submittedCount,
                viewedAt,
                enteredInitials: this.asString(intake.entered_initials),
                inviteToken,
                parentSessionId: s.parent_session_id || undefined,
                attemptNumber: this.asAttemptNumber(s.attempt_number),
                clientName: this.asString(s.client_name),
                candidateEmail: candidate.email || undefined,
                candidateFirstName: candidate.firstName || undefined,
                candidateLastName: candidate.lastName || undefined,
                engagedTimeSeconds: this.asNumber(intake.engaged_time_seconds),
                invitationSentAt: this.asTimestamp(s.invitation_sent_at)
            };
        });
    }

    async markViewed(sessionId: string): Promise<void> {
        const supabase = createAdminClient();
        const { data: current, error: fetchError } = await supabase
            .from('sessions')
            .select('intake_json')
            .eq('session_id', sessionId)
            .single();

        if (fetchError || !current) return;

        const intake = (current.intake_json as SessionIntake) || {};
        if (intake.viewed_at) return; // Already marked

        await supabase
            .from('sessions')
            .update({
                intake_json: {
                    ...intake,
                    viewed_at: Date.now()
                }
            })
            .eq('session_id', sessionId);
    }

    async get(id: string): Promise<InterviewSession | null> {
        const supabase = createAdminClient();

        // 1. Fetch Session Metadata
        const { data: sData, error: sError } = await supabase
            .from('sessions')
            .select('*')
            .eq('session_id', id)
            .single();

        if (sError || !sData) return null;

        // 2. Fetch Questions
        const { data: qData, error: qError } = await supabase
            .from('questions')
            .select('*')
            .eq('session_id', id)
            .order('question_index');

        if (qError) throw new Error(qError.message);

        // 3. Fetch Answers
        const { data: aData, error: aError } = await supabase
            .from('answers')
            .select('*')
            .eq('session_id', id);

        if (aError) throw new Error(aError.message);

        // Fetch Eval Results
        const { data: eData } = await supabase
            .from('eval_results')
            .select('*')
            .eq('session_id', id);

        const typedQData = (qData || []) as DbQuestion[];
        const typedAData = (aData || []) as DbAnswer[];
        const typedEData = (eData || []) as DbEval[];

        // Map Questions
        const questions: Question[] = typedQData.map((q) => ({
            id: q.question_id,
            text: q.question_text,
            category: q.category || "General",
            index: q.question_index
        }));

        // Map Answers
        const answers: Record<string, Answer> = {};
        typedAData.forEach((a) => {
            const myEval = typedEData.find((e) => e.question_id === a.question_id && e.attempt_number === a.attempt_number);

            answers[a.question_id] = {
                questionId: a.question_id,
                transcript: a.final_text || "",
                draft: a.draft_text || "",
                submittedAt: a.submitted_at ? new Date(a.submitted_at).getTime() : undefined,
                analysis: myEval
                    ? this.parseAnalysisResult(myEval.feedback_json, id, a.question_id)
                    : undefined
            };
        });

        const intake = this.asObject(sData.intake_json);
        const summaryExpiresAt = this.asTimestamp(intake.summary_expires_at);
        const summaryExpired =
            typeof sData.summary_narrative === "string" &&
            !!summaryExpiresAt &&
            Date.now() >= summaryExpiresAt;

        if (summaryExpired) {
            await this.clearExpiredSummary(id, sData.intake_json as SessionIntake | null | undefined);
        }

        const candidate = this.normalizeCandidate(intake.candidate);
        const candidateName = (candidate.firstName && candidate.lastName)
            ? `${candidate.firstName} ${candidate.lastName}`
            : candidate.fullName;

        const enteredInitials = this.asString(intake.entered_initials);
        const encryptedInviteToken = this.asString(intake.invite_token);

        return {
            id: sData.session_id,
            recruiterId: sData.recruiter_id,
            status: this.normalizeDbStatus(sData.status),
            role: sData.target_role,
            jobDescription: sData.job_description,
            currentQuestionIndex: sData.current_question_index,
            questions,
            answers,
            initialsRequired: !!candidateName && !enteredInitials,
            candidateName,
            enteredInitials,
            viewedAt: this.asTimestamp(intake.viewed_at),
            updatedAt: this.asTimestamp(sData.updated_at),
            summaryExpiresAt: summaryExpiresAt,
            summaryExpired,
            candidate: {
                firstName: candidate.firstName,
                lastName: candidate.lastName,
                email: candidate.email,
                resumeText: candidate.resumeText
            },
            engagedTimeSeconds: this.asNumber(intake.engaged_time_seconds) || 0,
            intakeData: intake,
            inviteToken: encryptedInviteToken ? ((): string | undefined => {
                try { return decrypt(encryptedInviteToken); }
                catch { return undefined; }
            })() : undefined,
            parentSessionId: sData.parent_session_id,
            attemptNumber: this.asAttemptNumber(sData.attempt_number),
            clientName: this.asString(sData.client_name),
            summaryNarrative: summaryExpired ? null : sData.summary_narrative
        };
    }

    async update(session: InterviewSession): Promise<void> {
        const supabase = createAdminClient();

        // 1. Prepare Session Update
        let dbStatus = session.status as string;
        if (session.status === "AWAITING_EVALUATION") {
            dbStatus = "AWAITING_EVAL"; // Existing DB enum value
        }

        const updates: Record<string, unknown> = {
            session_id: session.id,
            status: dbStatus,
            current_question_index: session.currentQuestionIndex,
            target_role: session.role,
            job_description: session.jobDescription,
            recruiter_id: session.recruiterId,
            parent_session_id: session.parentSessionId,
            attempt_number: session.attemptNumber,
            client_name: session.clientName,
            summary_narrative: session.summaryNarrative
        };

        // Fetch current intake to merge
        const { data: current } = await supabase
            .from('sessions')
            .select('intake_json')
            .eq('session_id', session.id)
            .single();

        const currentIntake = (current?.intake_json as SessionIntake) || {};

        // Merge intake data
        updates.intake_json = {
            ...currentIntake,
            candidate: { ...currentIntake.candidate, ...session.candidate },
            entered_initials: session.enteredInitials || currentIntake.entered_initials,
            engaged_time_seconds: session.engagedTimeSeconds ?? currentIntake.engaged_time_seconds,
            invite_token: session.inviteToken
                ? encrypt(session.inviteToken)
                : currentIntake.invite_token
        };

        const { error: sessionError } = await supabase
            .from('sessions')
            .upsert(updates as Record<string, unknown>);

        if (sessionError) {
            throw new Error(sessionError.message);
        }

        // 2. Upsert Questions
        if (session.questions.length > 0) {
            const qRows = session.questions.map((q, idx) => ({
                question_id: q.id,
                session_id: session.id,
                question_index: idx,
                question_text: q.text,
                category: q.category
            }));
            await supabase.from('questions').upsert(qRows);
        }

        // 3. Upsert Answers & Evals
        const aRows: Partial<DbAnswer>[] = [];
        const eRows: Partial<DbEval>[] = [];

        for (const [qid, ans] of Object.entries(session.answers)) {
            aRows.push({
                question_id: qid,
                session_id: session.id,
                final_text: ans.transcript,
                draft_text: ans.draft,
                submitted_at: ans.submittedAt ? new Date(ans.submittedAt).toISOString() : null
            });

            if (ans.analysis) {
                eRows.push({
                    question_id: qid,
                    session_id: session.id,
                    feedback_json: ans.analysis
                });
            }
        }

        if (aRows.length > 0) await supabase.from('answers').upsert(aRows as Record<string, unknown>[], { onConflict: 'question_id, attempt_number' });
        if (eRows.length > 0) await supabase.from('eval_results').upsert(eRows as Record<string, unknown>[], { onConflict: 'question_id, attempt_number' });
    }

    async updatePartial(id: string, updates: Partial<InterviewSession>): Promise<void> {
        const supabase = createAdminClient();
        const dbUpdates: Record<string, unknown> = {};

        if (updates.status) {
            if (updates.status === 'AWAITING_EVALUATION') {
                dbUpdates.status = 'AWAITING_EVAL';
            } else {
                dbUpdates.status = updates.status;
            }
        }
        if (updates.currentQuestionIndex !== undefined) dbUpdates.current_question_index = updates.currentQuestionIndex;
        if (updates.role) dbUpdates.target_role = updates.role;
        if (updates.jobDescription) dbUpdates.job_description = updates.jobDescription;
        if (updates.recruiterId) dbUpdates.recruiter_id = updates.recruiterId;
        if (updates.parentSessionId) dbUpdates.parent_session_id = updates.parentSessionId;
        if (updates.attemptNumber) dbUpdates.attempt_number = updates.attemptNumber;
        if (updates.clientName) dbUpdates.client_name = updates.clientName;
        if (updates.summaryNarrative !== undefined) dbUpdates.summary_narrative = updates.summaryNarrative;

        // Handle intake_json updates (Initials, Engagement)
        const shouldPatchIntake =
            updates.enteredInitials !== undefined ||
            updates.engagedTimeSeconds !== undefined ||
            updates.inviteToken !== undefined;

        if (shouldPatchIntake) {
            const { data: current } = await supabase
                .from('sessions')
                .select('intake_json')
                .eq('session_id', id)
                .single();

            const currentIntake = (current?.intake_json as SessionIntake) || {};
            const newIntake = { ...currentIntake };

            if (updates.enteredInitials !== undefined) {
                newIntake.entered_initials = updates.enteredInitials;
            }

            if (updates.engagedTimeSeconds !== undefined) {
                // Absolute update (ensure it never goes backwards)
                newIntake.engaged_time_seconds = Math.max(newIntake.engaged_time_seconds || 0, updates.engagedTimeSeconds);
            }

            if (updates.inviteToken !== undefined) {
                newIntake.invite_token = encrypt(updates.inviteToken);
            }

            dbUpdates.intake_json = newIntake;
        }

        if (Object.keys(dbUpdates).length > 0) {
            const { error: patchError } = await supabase.from('sessions').update(dbUpdates as Record<string, unknown>).eq('session_id', id);

            if (patchError) {
                Logger.error("[Repo] updatePartial Failed", patchError);
            }
        }

        if (updates.engagedTimeDelta !== undefined) {
            await this.incrementEngagementTime(id, updates.engagedTimeDelta);
        }

        // Similar logic for questions/answers if provided in updates... 
        // For brevity, assuming updatePartial primarily handles metadata here.
        if (updates.answers) {
            // Re-use logic from update for answers/evals
            const aRows: Partial<DbAnswer>[] = [];
            const eRows: Partial<DbEval>[] = [];
            for (const [qid, ans] of Object.entries(updates.answers)) {
                aRows.push({
                    question_id: qid,
                    session_id: id,
                    final_text: ans.transcript,
                    draft_text: ans.draft,
                    submitted_at: ans.submittedAt ? new Date(ans.submittedAt).toISOString() : null
                });
                if (ans.analysis) {
                    eRows.push({
                        question_id: qid,
                        session_id: id,
                        feedback_json: ans.analysis
                    });
                }
            }
            if (aRows.length > 0) await supabase.from('answers').upsert(aRows as Record<string, unknown>[], { onConflict: 'question_id, attempt_number' });
            if (eRows.length > 0) await supabase.from('eval_results').upsert(eRows as Record<string, unknown>[], { onConflict: 'question_id, attempt_number' });
        }
    }

    async saveDraft(sessionId: string, questionId: string, draftText: string): Promise<void> {
        const supabase = createAdminClient();
        await supabase.from('answers').upsert({
            session_id: sessionId,
            question_id: questionId,
            draft_text: draftText
        } as Record<string, unknown>, { onConflict: 'session_id, question_id, attempt_number' });
    }

    async deleteAnalysis(sessionId: string, questionId: string): Promise<void> {
        const supabase = createAdminClient();
        await supabase.from('eval_results').delete().eq('session_id', sessionId).eq('question_id', questionId);
    }

    async setSummaryExpiry(sessionId: string, expiresAt: number): Promise<void> {
        const supabase = createAdminClient();
        const { data: current } = await supabase
            .from("sessions")
            .select("intake_json")
            .eq("session_id", sessionId)
            .single();

        const currentIntake = (current?.intake_json as SessionIntake) || {};
        const { error } = await supabase
            .from("sessions")
            .update({
                intake_json: {
                    ...currentIntake,
                    summary_expires_at: expiresAt
                }
            })
            .eq("session_id", sessionId);

        if (error) {
            Logger.error("[Repo] setSummaryExpiry Failed", error);
        }
    }

    async delete(id: string): Promise<void> {
        const supabase = createAdminClient();
        const { error } = await supabase.from('sessions').delete().eq('session_id', id);
        if (error) throw new Error(error.message);
    }

    async markInvitationSent(sessionId: string): Promise<void> {
        const supabase = createAdminClient();
        const { error } = await supabase
            .from('sessions')
            .update({ invitation_sent_at: new Date().toISOString() })
            .eq('session_id', sessionId);

        if (error) {
            throw new Error(`Failed to mark invitation sent: ${error.message}`);
        }
    }
}
