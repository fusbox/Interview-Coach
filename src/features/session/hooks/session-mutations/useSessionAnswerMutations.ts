import { useCallback } from "react";
import { ApiClient } from "@/lib/api-client";
import { InterviewSessionSchema } from "@/lib/domain/schemas";
import { InterviewSession } from "@/lib/domain/types";
import { Logger } from "@/lib/logger";
import { SESSION_STATUS } from "@/lib/constants";
import { buildSubmitIdempotencyKey, CommandGate, SessionMutationWithNow } from "./shared";

type AnsweringArgs = SessionMutationWithNow & {
    commandGate: CommandGate;
};

export function useSessionAnswerMutations({
    session,
    setSession,
    candidateToken,
    mergeSession,
    now,
    commandGate
}: AnsweringArgs) {
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
            Logger.error("Analysis trigger failed", e);
        }
    }, [session, now.currentQuestionId, candidateToken, mergeSession]);

    const submit = useCallback(async (answerText: string, audioBlob?: Blob | null) => {
        if (!session || !now.currentQuestionId) return;
        if (!commandGate.tryBeginCommand("submit", session.id)) return;

        const previousSessionSnapshot = session;

        try {
            setSession((prev: InterviewSession | null | undefined) => {
                if (!prev) return undefined;
                const qid = now.currentQuestionId!;
                return {
                    ...prev,
                    status: SESSION_STATUS.AWAITING_EVALUATION,
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

            let audioData: { base64: string; mimeType: string } | undefined;
            if (audioBlob) {
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve) => {
                    reader.onloadend = () => {
                        const base64String = (reader.result as string).split(",")[1];
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
            setSession(previousSessionSnapshot);
            alert("Network error: Failed to submit your answer. Please check your connection and try again.");
        } finally {
            commandGate.finishCommand("submit", session.id);
        }
    }, [session, now.currentQuestionId, candidateToken, setSession, mergeSession, analyzeCurrentQuestion, commandGate]);

    const saveDraft = useCallback(async (text: string) => {
        if (!session || !now.currentQuestionId) return;

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
            .catch((e) => Logger.error("Draft save failed", e));
    }, [session, now.currentQuestionId, candidateToken, setSession]);

    const retry = useCallback(async (retryContext?: { trigger: "user" | "coach"; focus?: string }) => {
        if (!session || !now.currentQuestionId) return;
        if (!commandGate.tryBeginCommand("retry", session.id)) return;
        const qid = now.currentQuestionId;
        const previousSessionSnapshot = session;

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
                        retryContext
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
            commandGate.finishCommand("retry", session.id);
        }
    }, [session, now.currentQuestionId, candidateToken, setSession, mergeSession, commandGate]);

    return {
        analyzeCurrentQuestion,
        submit,
        saveDraft,
        retry
    };
}
