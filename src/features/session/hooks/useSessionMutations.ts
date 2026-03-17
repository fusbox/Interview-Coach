import { useCallback, useRef, useMemo, Dispatch, SetStateAction } from "react";
import { InterviewSession } from "@/lib/domain/types";
import { selectNow } from "@/lib/state/selectors";
import { STORAGE_KEYS, SESSION_STATUS } from "@/lib/constants";
import { ApiClient } from "@/lib/api-client";
import { InterviewSessionSchema } from "@/lib/domain/schemas";
import { Logger } from "@/lib/logger";

type ExclusiveCommandName = "start" | "submit" | "next" | "retry";
type CommandState = {
    name: ExclusiveCommandName;
    sessionId: string;
};

function buildSubmitIdempotencyKey(sessionId: string, questionId: string, answerText: string): string {
    let hash = 0;
    const input = `${sessionId}:${questionId}:${answerText}`;
    for (let index = 0; index < input.length; index += 1) {
        hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
    }

    return `submit:${sessionId}:${questionId}:${Math.abs(hash)}`;
}

export function useSessionMutations(
    session: InterviewSession | null | undefined,
    setSession: Dispatch<SetStateAction<InterviewSession | null | undefined>>,
    candidateToken?: string
) {
    const now = useMemo(() => selectNow(session), [session]);
    const activeCommandRef = useRef<CommandState | null>(null);
    const activeInitPromiseRef = useRef<Promise<{ sessionId: string; candidateToken: string } | undefined> | null>(null);

    /**
     * Merges a new session object with the current local state, 
     * ensuring we never roll back the engagement clock.
     */
    const mergeSession = useCallback((updated: InterviewSession) => {
        setSession((prev) => {
            if (!prev) return updated;
            return {
                ...updated,
                engagedTimeSeconds: Math.max(prev.engagedTimeSeconds || 0, updated.engagedTimeSeconds || 0)
            };
        });
    }, [setSession]);

    const tryBeginCommand = useCallback((command: ExclusiveCommandName, sessionId: string) => {
        const active = activeCommandRef.current;
        if (active && active.sessionId === sessionId) {
            Logger.info("Ignored overlapping session command", {
                activeCommand: active.name,
                ignoredCommand: command,
                sessionId
            }, "SessionMutations");
            return false;
        }

        activeCommandRef.current = { name: command, sessionId };
        return true;
    }, []);

    const finishCommand = useCallback((command: ExclusiveCommandName, sessionId: string) => {
        const active = activeCommandRef.current;
        if (active?.name === command && active.sessionId === sessionId) {
            activeCommandRef.current = null;
        }
    }, []);

    const init = useCallback(async (role: string, parentId?: string) => {
        if (activeInitPromiseRef.current) return activeInitPromiseRef.current;

        const promise = (async () => {
            try {
                const { data: newSession, headers } = await ApiClient.postWithHeaders<InterviewSession>(
                    '/api/session/start',
                    { role, parentId },
                    { token: candidateToken, schema: InterviewSessionSchema }
                );
                setSession(newSession);
                localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION_ID, newSession.id);

                const newToken = headers.get('x-candidate-token');
                return { sessionId: newSession.id, candidateToken: newToken ? newToken : '' };
            } catch (e) {
                Logger.error("Session Init Failed", e);
                throw e;
            } finally {
                activeInitPromiseRef.current = null;
            }
        })();

        activeInitPromiseRef.current = promise;
        return promise;
    }, [setSession]);

    const start = useCallback(async () => {
        if (!session) return;
        if (!tryBeginCommand("start", session.id)) return;

        const previousSessionSnapshot = session;

        try {
            setSession((prev: InterviewSession | null | undefined) => prev ? { ...prev, status: "IN_SESSION" } : undefined);

            const updated = await ApiClient.patch<InterviewSession>(`/api/session/${session.id}`, { status: "IN_SESSION" }, { token: candidateToken, schema: InterviewSessionSchema });
            mergeSession(updated);
        } catch (e) {
            Logger.error("Session start failed", e);
            setSession(previousSessionSnapshot);
            throw e;
        } finally {
            finishCommand("start", session.id);
        }
    }, [session, candidateToken, setSession, mergeSession, tryBeginCommand, finishCommand]);

    const analyzeCurrentQuestion = useCallback(async (audioData?: { base64: string; mimeType: string }) => {
        if (!session || !now.currentQuestionId) return;

        try {
            const updated = await ApiClient.post<InterviewSession>(
                `/api/session/${session.id}/questions/${now.currentQuestionId}/analysis`,
                { audioData },
                { token: candidateToken, schema: InterviewSessionSchema }
            );
            mergeSession(updated);
        } catch (e) {
            console.error("Analysis trigger failed:", e);
        }
    }, [session, now.currentQuestionId, candidateToken, mergeSession]);

    const submit = useCallback(async (answerText: string, audioBlob?: Blob | null) => {
        if (!session || !now.currentQuestionId) return;
        if (!tryBeginCommand("submit", session.id)) return;

        const previousSessionSnapshot = session; // Snapshot for rollback

        try {
            // Optimistic Update
            setSession((prev: InterviewSession | null | undefined) => {
                if (!prev) return undefined;
                const qid = now.currentQuestionId!;
                return {
                    ...prev,
                    status: "AWAITING_EVALUATION",
                    answers: {
                        ...prev.answers,
                        [qid]: {
                            ...prev.answers[qid],
                            questionId: qid,
                            transcript: answerText,
                            submittedAt: Date.now(),
                            analysis: undefined,
                            draft: undefined
                        }
                    }
                };
            });

            const updated = await ApiClient.post<InterviewSession>(
                `/api/session/${session.id}/questions/${now.currentQuestionId}/submit`,
                { text: answerText },
                {
                    token: candidateToken,
                    schema: InterviewSessionSchema,
                    headers: {
                        "Idempotency-Key": buildSubmitIdempotencyKey(session.id, now.currentQuestionId, answerText)
                    }
                }
            );

            Logger.info("Submit success", { updatedStatus: updated.status });
            mergeSession(updated);

            // Prepare audio data if present
            let audioData: { base64: string; mimeType: string } | undefined;
            if (audioBlob) {
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve) => {
                    reader.onloadend = () => {
                        const base64String = (reader.result as string).split(',')[1];
                        resolve(base64String);
                    };
                });
                reader.readAsDataURL(audioBlob);
                const base64 = await base64Promise;
                audioData = { base64, mimeType: audioBlob.type };
            }

            await analyzeCurrentQuestion(audioData);
        } catch (e) {
            Logger.error("Submit failed with exception", e);
            // Revert optimistic update so the UI doesn't hang forever
            setSession(previousSessionSnapshot);
            alert("Network error: Failed to submit your answer. Please check your connection and try again.");
        } finally {
            finishCommand("submit", session.id);
        }
    }, [session, now.currentQuestionId, candidateToken, setSession, mergeSession, analyzeCurrentQuestion, tryBeginCommand, finishCommand]);

    const submitInitials = useCallback(async (initials: string) => {
        if (!session) return;

        // Optimistic
        setSession((prev: InterviewSession | null | undefined) => prev ? {
            ...prev,
            enteredInitials: initials,
            initialsRequired: false
        } : undefined);

        const updated = await ApiClient.patch<InterviewSession>(
            `/api/session/${session.id}`,
            { enteredInitials: initials, initialsRequired: false },
            { token: candidateToken, schema: InterviewSessionSchema }
        );
        mergeSession(updated);
    }, [session, candidateToken, setSession, mergeSession]);

    const saveDraft = useCallback(async (text: string) => {
        if (!session || !now.currentQuestionId) return;

        // Optimistic
        setSession((prev: InterviewSession | null | undefined) => {
            if (!prev) return undefined;
            const qid = now.currentQuestionId!;
            const currentAns = prev.answers[qid] || {};

            return {
                ...prev,
                answers: {
                    ...prev.answers,
                    [qid]: {
                        ...currentAns,
                        questionId: qid,
                        draft: text
                    }
                }
            };
        });

        const url = `/api/session/${session.id}/questions/${now.currentQuestionId}/answer`;
        await ApiClient.put<{ success: boolean }>(url, { text, isFinal: false }, { token: candidateToken })
            .catch(e => console.error("[useDomainSession] saveDraft Error:", e));
    }, [session, now.currentQuestionId, candidateToken, setSession]);

    const next = useCallback(async () => {
        if (!session) return;
        if (!tryBeginCommand("next", session.id)) return;

        const previousSessionSnapshot = session;

        try {
            const nextIdx = session.currentQuestionIndex + 1;
            const isComplete = nextIdx >= session.questions.length;
            const nextStatus = isComplete ? SESSION_STATUS.COMPLETED : SESSION_STATUS.IN_SESSION;

            // Optimistic
            setSession((prev: InterviewSession | null | undefined) => prev ? {
                ...prev,
                currentQuestionIndex: nextIdx,
                status: nextStatus
            } : undefined);

            const updated = await ApiClient.patch<InterviewSession>(
                `/api/session/${session.id}`,
                {
                    currentQuestionIndex: nextIdx,
                    status: nextStatus
                },
                { token: candidateToken, schema: InterviewSessionSchema }
            );
            mergeSession(updated);
        } catch (e) {
            Logger.error("Next question failed", e);
            setSession(previousSessionSnapshot);
            throw e;
        } finally {
            finishCommand("next", session.id);
        }
    }, [session, candidateToken, setSession, mergeSession, tryBeginCommand, finishCommand]);

    const retry = useCallback(async (retryContext?: { trigger: 'user' | 'coach'; focus?: string }) => {
        if (!session || !now.currentQuestionId) return;
        if (!tryBeginCommand("retry", session.id)) return;
        const qid = now.currentQuestionId;
        const previousSessionSnapshot = session;

        // Optimistic
        setSession((prev: InterviewSession | null | undefined) => {
            if (!prev) return undefined;
            const currentAns = prev.answers[qid];
            if (!currentAns) return prev;

            return {
                ...prev,
                status: SESSION_STATUS.IN_SESSION,
                answers: {
                    ...prev.answers,
                    [qid]: {
                        ...currentAns,
                        submittedAt: undefined,
                        analysis: undefined,
                        retryContext: retryContext
                    }
                }
            };
        });

        try {
            const updated = await ApiClient.post<InterviewSession>(
                `/api/session/${session.id}/questions/${qid}/retry`,
                { retryContext },
                { token: candidateToken, schema: InterviewSessionSchema }
            );
            mergeSession(updated);
        } catch (e) {
            Logger.error("Retry question failed", e);
            setSession(previousSessionSnapshot);
            throw e;
        } finally {
            finishCommand("retry", session.id);
        }
    }, [session, now.currentQuestionId, candidateToken, setSession, mergeSession, tryBeginCommand, finishCommand]);

    const goToQuestion = useCallback(async (index: number) => {
        if (!session) return;

        // Validation
        let maxAllowed = 0;
        for (let i = 0; i < session.questions.length; i++) {
            const q = session.questions[i];
            const ans = session.answers[q.id];
            if (ans?.submittedAt) {
                maxAllowed = i + 1;
            } else {
                maxAllowed = i;
                break;
            }
        }

        if (session.answers[session.questions[session.questions.length - 1].id]?.submittedAt) {
            maxAllowed = session.questions.length - 1;
        }

        if (index < 0 || index > maxAllowed) {
            console.warn(`[useDomainSession] goToQuestion blocked: ${index} > ${maxAllowed}`);
            return;
        }

        // Optimistic
        setSession((prev: InterviewSession | null | undefined) => prev ? {
            ...prev,
            currentQuestionIndex: index,
            status: SESSION_STATUS.IN_SESSION
        } : undefined);

        const updated = await ApiClient.patch<InterviewSession>(
            `/api/session/${session.id}`,
            { currentQuestionIndex: index },
            { token: candidateToken, schema: InterviewSessionSchema }
        );
        mergeSession(updated);
    }, [session, candidateToken, setSession, mergeSession]);

    const updateSession = useCallback(async (updates: Partial<InterviewSession>) => {
        if (!session) return;

        // Optimistic
        setSession((prev: InterviewSession | null | undefined) => prev ? { ...prev, ...updates } : undefined);

        const updated = await ApiClient.patch<InterviewSession>(`/api/session/${session.id}`, updates, { token: candidateToken, schema: InterviewSessionSchema });
        mergeSession(updated);
    }, [session, candidateToken, setSession, mergeSession]);

    const recordEngagement = useCallback(async (deltaSeconds: number) => {
        if (!session) return;

        // Optimistic update using delta to avoid stale clock read
        setSession((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                engagedTimeSeconds: (prev.engagedTimeSeconds || 0) + deltaSeconds
            };
        });

        // Patch to server
        try {
            await ApiClient.patch(`/api/session/${session.id}`,
                { engagedTimeDelta: deltaSeconds },
                { token: candidateToken }
            );
        } catch (e) {
            // Silently log background pings to prevent app crashes on flaky networks
            Logger.warn("Engagement ping failed", e);
        }
    }, [session, candidateToken, setSession]);

    const reset = useCallback(async () => {
        if (!session) return;

        // Optimistic
        setSession((prev: InterviewSession | null | undefined) => prev ? {
            ...prev,
            status: SESSION_STATUS.IN_SESSION,
            currentQuestionIndex: 0,
            answers: {}
        } : undefined);

        const updated = await ApiClient.post<InterviewSession>(`/api/session/${session.id}/reset`, {}, { token: candidateToken, schema: InterviewSessionSchema });
        mergeSession(updated);
    }, [session, candidateToken, setSession, mergeSession]);

    return {
        init,
        start,
        submit,
        submitInitials,
        saveDraft,
        next,
        retry,
        goToQuestion,
        analyzeCurrentQuestion,
        updateSession,
        recordEngagement,
        reset
    };
}
