import { SessionRepository } from "@/lib/domain/repository";
import { InterviewSession, Answer, Question, SessionSummary, SessionStatus, AnalysisResult, SessionDashboardMetrics, EvalInsights } from "@/lib/domain/types";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { Logger } from "@/lib/logger";
import { decrypt } from "@/lib/server/encryption";
import { ReadinessAggregator, ReadinessLevel } from "@/lib/server/session/readiness-aggregator";
import { AIService } from "../services/ai-service";

interface SessionIntake {
    candidate?: { firstName?: string; lastName?: string; name?: string; email?: string; resumeText?: string };
    invite_token?: string;
    viewed_at?: number;
    entered_initials?: string;
    engaged_time_seconds?: number;
    retry_contexts?: Record<string, unknown>;
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
    readiness_band: string | null;
    summary_narrative: string | null;
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
    feedback_json: AnalysisResult | null;
    attempt_number: number;
}

export class SupabaseSessionRepository implements SessionRepository {
    async create(session: InterviewSession): Promise<void> {
        await this.update(session);
    }

    async getDashboardMetrics(recruiterId: string): Promise<SessionDashboardMetrics> {
        const supabase = createClient();

        // 1. Fetch Sessions Metadata
        const { data: sessions, error: sError } = await supabase
            .from('sessions')
            .select('session_id, status, readiness_band, intake_json, created_at')
            .eq('recruiter_id', recruiterId);

        if (sError) throw new Error(sError.message);

        // 2. Fetch all Eval Results for these sessions to get aggregate coaching focus
        const { data: evals, error: eError } = await supabase
            .from('eval_results')
            .select('feedback_json')
            .eq('recruiter_id', recruiterId); // Assumes recruiter_id exists on eval_results or we need to join

        // Fallback: If recruiter_id doesn't exist on eval_results, we'd need a join or in-clause.
        // Let's check if recruiter_id is in eval_results first. (I'll assume it is based on architecture patterns if it exists, otherwise I'll use session_id IN (...))

        // For safety, let's use the session IDs if we have them.
        let finalEvals = evals;
        if (eError || !evals) {
            const sessionIds = sessions.map(s => s.session_id);
            if (sessionIds.length > 0) {
                const { data: retryEvals } = await supabase
                    .from('eval_results')
                    .select('feedback_json')
                    .in('session_id', sessionIds);
                finalEvals = retryEvals;
            } else {
                finalEvals = [];
            }
        }

        // 3. Compute Basic Aggregates
        const totalInvites = sessions.length;
        let activeSessions = 0;
        let completedSessions = 0;
        let stalledSessions = 0;
        let totalEngagedTime = 0;
        const readinessDistribution: Record<'RL1' | 'RL2' | 'RL3' | 'RL4', number> = { RL1: 0, RL2: 0, RL3: 0, RL4: 0 };

        sessions.forEach(s => {
            const status = s.status;
            const intake = (s.intake_json as SessionIntake) || {};

            if (status === 'COMPLETED') completedSessions++;
            else if (['IN_SESSION', 'AWAITING_EVALUATION', 'REVIEWING'].includes(status)) activeSessions++;

            // Stalled: Viewed but no progress (assuming empty answers/questions if we had that, but let's use viewedAt)
            if (intake.viewed_at && status === 'NOT_STARTED') stalledSessions++;

            totalEngagedTime += (intake.engaged_time_seconds || 0);

            if (s.readiness_band && (s.readiness_band in readinessDistribution)) {
                readinessDistribution[s.readiness_band as keyof typeof readinessDistribution]++;
            }
        });

        // 4. Compute Insights from Evals
        const coachingFocusDistribution: Record<string, number> = {};
        const observationCounts: Record<string, number> = {};

        finalEvals?.forEach(e => {
            const feedback = e.feedback_json as AnalysisResult;
            if (feedback?.primaryFocus?.dimension) {
                coachingFocusDistribution[feedback.primaryFocus.dimension] = (coachingFocusDistribution[feedback.primaryFocus.dimension] || 0) + 1;
            }
            feedback?.observations?.forEach(obs => {
                observationCounts[obs] = (observationCounts[obs] || 0) + 1;
            });
        });

        const commonObservations = Object.entries(observationCounts)
            .map(([text, count]) => ({ text, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            totalInvites,
            activeSessions,
            completedSessions,
            stalledSessions,
            averageEngagementTimeSeconds: totalInvites > 0 ? totalEngagedTime / totalInvites : 0,
            readinessDistribution,
            coachingFocusDistribution,
            commonObservations
        };
    }

    /**
     * Fetch only eval-derived coaching insights (no sessions re-fetch).
     * Used by CoachingFocusCard and TopOpportunitiesCard.
     */
    async getEvalInsights(recruiterId: string): Promise<EvalInsights> {
        const supabase = createClient();

        const { data: sessions } = await supabase
            .from('sessions')
            .select('session_id')
            .eq('recruiter_id', recruiterId);

        if (!sessions || sessions.length === 0) {
            return { coachingFocusDistribution: {}, commonObservations: [] };
        }

        const sessionIds = sessions.map(s => s.session_id);

        // Try recruiter_id first, fallback to session_id IN (...)
        let evals: { feedback_json: AnalysisResult | null }[] | null = null;
        const { data: directEvals, error } = await supabase
            .from('eval_results')
            .select('feedback_json')
            .eq('recruiter_id', recruiterId);

        if (error || !directEvals) {
            const { data: fallbackEvals } = await supabase
                .from('eval_results')
                .select('feedback_json')
                .in('session_id', sessionIds);
            evals = fallbackEvals;
        } else {
            evals = directEvals;
        }

        const coachingFocusDistribution: Record<string, number> = {};
        const observationCounts: Record<string, number> = {};

        evals?.forEach(e => {
            const feedback = e.feedback_json as AnalysisResult;
            if (feedback?.primaryFocus?.dimension) {
                coachingFocusDistribution[feedback.primaryFocus.dimension] =
                    (coachingFocusDistribution[feedback.primaryFocus.dimension] || 0) + 1;
            }
            feedback?.observations?.forEach(obs => {
                observationCounts[obs] = (observationCounts[obs] || 0) + 1;
            });
        });

        const commonObservations = Object.entries(observationCounts)
            .map(([text, count]) => ({ text, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return { coachingFocusDistribution, commonObservations };
    }

    async listByRecruiter(recruiterId: string): Promise<SessionSummary[]> {
        const supabase = createClient();

        // 1. Fetch Sessions
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
                readiness_band,
                summary_narrative,
                questions(count),
                answers(submitted_at)
            `)
            .eq('recruiter_id', recruiterId)
            .order('created_at', { ascending: false });

        let sessionsFinal: DbSession[] | null = sessionsInitial as unknown as DbSession[];

        if (error) {
            // Check for missing column error 42703 (Undefined Column)
            if (error.code === '42703') {
                Logger.warn("[SupabaseSessionRepo] List columns missing (readiness_band). Retrying without them.", error);
                const { data: fallbackSessions, error: fallbackError } = await supabase
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
                        answers(submitted_at)
                    `)
                    .eq('recruiter_id', recruiterId)
                    .order('created_at', { ascending: false });

                if (fallbackError) throw new Error(fallbackError.message);
                sessionsFinal = fallbackSessions as unknown as DbSession[];
            } else {
                Logger.error("[SupabaseSessionRepo] List Failed", error);
                throw new Error(error.message);
            }
        }

        if (!sessionsFinal) return [];

        // 2. Map to Summary
        return sessionsFinal.map((s: DbSession) => {
            const intake = s.intake_json || {};
            const c = intake.candidate || {};
            const candidateName = (c.firstName && c.lastName)
                ? `${c.firstName} ${c.lastName}`
                : (c.name || "Anonymous Candidate");

            const inviteToken = intake.invite_token ? decrypt(intake.invite_token) : undefined;
            const viewedAt = intake.viewed_at as number | undefined;

            // Extract counts correctly from Supabase response
            const questionCount = s.questions?.[0]?.count || 0;
            const answers = s.answers || [];
            const answerCount = answers.length;
            const submittedCount = answers.filter((a: { submitted_at: string | null }) => !!a.submitted_at).length;

            // Derived Status for consistency
            let derivedStatus = s.status as SessionStatus;
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
                createdAt: new Date(s.created_at).getTime(),
                updatedAt: new Date(s.updated_at).getTime(),
                questionCount,
                answerCount,
                submittedCount,
                viewedAt,
                enteredInitials: intake.entered_initials as string | undefined,
                inviteToken,
                parentSessionId: s.parent_session_id || undefined,
                attemptNumber: s.attempt_number || undefined,
                clientName: s.client_name || undefined,
                readinessBand: s.readiness_band as 'RL1' | 'RL2' | 'RL3' | 'RL4' | undefined,
                summaryNarrative: s.summary_narrative || (s.readiness_band ? ReadinessAggregator.generateNarrative(s.readiness_band as 'RL1' | 'RL2' | 'RL3' | 'RL4') : undefined),
                engagedTimeSeconds: intake.engaged_time_seconds as number | undefined
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
                analysis: myEval ? (myEval.feedback_json as AnalysisResult) : undefined
            };
        });

        const intake = sData.intake_json || {};
        const c = intake.candidate || {};
        const candidateName = (c.firstName && c.lastName)
            ? `${c.firstName} ${c.lastName}`
            : c.name;

        const enteredInitials = intake.entered_initials;

        return {
            id: sData.session_id,
            recruiterId: sData.recruiter_id,
            status: sData.status as SessionStatus,
            role: sData.target_role,
            jobDescription: sData.job_description,
            currentQuestionIndex: sData.current_question_index,
            questions,
            answers,
            initialsRequired: !!candidateName && !enteredInitials,
            candidateName,
            enteredInitials,
            viewedAt: intake.viewed_at,
            updatedAt: sData.updated_at ? new Date(sData.updated_at).getTime() : undefined,
            candidate: {
                firstName: c.firstName || "",
                lastName: c.lastName || "",
                email: c.email || "",
                resumeText: c.resumeText || undefined
            },
            engagedTimeSeconds: intake.engaged_time_seconds || 0,
            intakeData: intake,
            inviteToken: intake.invite_token ? decrypt(intake.invite_token) : undefined,
            parentSessionId: sData.parent_session_id,
            attemptNumber: sData.attempt_number,
            clientName: sData.client_name,
            readinessBand: sData.readiness_band as 'RL1' | 'RL2' | 'RL3' | 'RL4' | undefined,
            summaryNarrative: sData.summary_narrative || (sData.readiness_band ? ReadinessAggregator.generateNarrative(sData.readiness_band as 'RL1' | 'RL2' | 'RL3' | 'RL4') : undefined)
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
            client_name: session.clientName
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
            engaged_time_seconds: session.engagedTimeSeconds ?? currentIntake.engaged_time_seconds
        };

        // Automatically aggregate readiness if data is available
        const derivedRL = ReadinessAggregator.aggregateSession({ ...session, status: updates.status as SessionStatus || session.status });
        updates.readiness_band = (updates.status === 'COMPLETED') ? derivedRL : (session.readinessBand || derivedRL);

        // Dynamic Narrative Generation on Completion
        const stockNarratives = ['RL1', 'RL2', 'RL3', 'RL4'].map(r => ReadinessAggregator.generateNarrative(r as ReadinessLevel));
        const isStockNarrative = !session.summaryNarrative || stockNarratives.includes(session.summaryNarrative);

        if (updates.status === 'COMPLETED' && isStockNarrative) {
            Logger.info(`[Repo] Session ${session.id} completed. Generating dynamic summary.`);
            updates.summary_narrative = await AIService.summarizeSession(session);
        } else if (!updates.summary_narrative) {
            // Only set a stock narrative if we don't have one and it's currently null/stock
            if (isStockNarrative) {
                updates.summary_narrative = (updates.readiness_band ? ReadinessAggregator.generateNarrative(updates.readiness_band as ReadinessLevel) : undefined);
            } else {
                updates.summary_narrative = session.summaryNarrative;
            }
        }

        const { error: sessionError } = await supabase
            .from('sessions')
            .upsert(updates as Record<string, unknown>);

        if (sessionError && sessionError.code === '42703') {
            Logger.warn("[Repo] Readiness columns missing during update. Retrying without them.");
            delete updates.readiness_band;
            delete updates.summary_narrative;
            const { error: retryError } = await supabase.from('sessions').upsert(updates as Record<string, unknown>);
            if (retryError) throw new Error(retryError.message);
        } else if (sessionError) {
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

        // Handle intake_json updates (Initials, Engagement)
        if (updates.enteredInitials !== undefined || updates.engagedTimeDelta !== undefined || updates.engagedTimeSeconds !== undefined) {
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

            if (updates.engagedTimeDelta !== undefined) {
                newIntake.engaged_time_seconds = (newIntake.engaged_time_seconds || 0) + updates.engagedTimeDelta;
            } else if (updates.engagedTimeSeconds !== undefined) {
                // Absolute update (ensure it never goes backwards)
                newIntake.engaged_time_seconds = Math.max(newIntake.engaged_time_seconds || 0, updates.engagedTimeSeconds);
            }

            dbUpdates.intake_json = newIntake;
        }

        if (Object.keys(dbUpdates).length > 0) {
            // If status is becoming COMPLETED, try to generate a summary if missing
            if (dbUpdates.status === 'COMPLETED') {
                const session = await this.get(id);
                // Force summary if it's currently any stock narrative or null
                const stockNarratives = ['RL1', 'RL2', 'RL3', 'RL4'].map(r => ReadinessAggregator.generateNarrative(r as ReadinessLevel));
                const isStockNarrative = !session?.summaryNarrative || stockNarratives.includes(session.summaryNarrative);

                if (session && isStockNarrative) {
                    Logger.info(`[Repo] Session ${id} completed via partial update. Generating dynamic summary.`);
                    dbUpdates.summary_narrative = await AIService.summarizeSession(session);

                    // Force re-aggregation to avoid sticky RL4
                    const derivedRL = ReadinessAggregator.aggregateSession({ ...session, status: 'COMPLETED' });
                    dbUpdates.readiness_band = derivedRL;
                }
            }

            const { error: patchError } = await supabase.from('sessions').update(dbUpdates as Record<string, unknown>).eq('session_id', id);

            if (patchError && patchError.code === '42703') {
                Logger.warn("[Repo] readiness columns missing in updatePartial. Retrying without them.");
                delete dbUpdates.readiness_band;
                delete dbUpdates.summary_narrative;
                await supabase.from('sessions').update(dbUpdates as Record<string, unknown>).eq('session_id', id);
            } else if (patchError) {
                Logger.error("[Repo] updatePartial Failed", patchError);
            }
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

    async delete(id: string): Promise<void> {
        const supabase = createAdminClient();
        const { error } = await supabase.from('sessions').delete().eq('session_id', id);
        if (error) throw new Error(error.message);
    }
}
