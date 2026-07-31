"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";

import type { SessionAnswerMutationPhase } from "@/features/interview-session-v2/session-answer-mutation-contract";
import type { VoiceTranscriptDraft } from "@/features/interview-session-v2/voice-answer-transcription";
import type {
    CandidateAnswerDraft,
    CandidateAnswerDrafts,
    CandidateAnswerSubmissions,
} from "./candidate-answer-lifecycle";
import type { CandidateAnswerAnalysisSnapshots } from "./candidate-provisional-session-store";
import {
    parseCandidateAnswerAnalysisRecovery,
    type CandidateAnswerAnalysisRecovery,
} from "./candidate-answer-analysis-recovery";

const CANDIDATE_ANSWER_DRAFT_SAVE_DELAY_MS = 600;

type CandidateTypedAnswerMutationInput = {
    sessionId: string;
    mutationBasePath?: string;
    hasDurableSession: boolean;
    setAnswerDrafts: Dispatch<SetStateAction<CandidateAnswerDrafts>>;
    setAnswerSubmissions: Dispatch<SetStateAction<CandidateAnswerSubmissions>>;
    setAnswerAnalysisSnapshots: Dispatch<SetStateAction<CandidateAnswerAnalysisSnapshots>>;
    saveBrowserDraft: (draft: CandidateAnswerDraft) => void;
    onAnswerSubmissionSaved?: (slotId: string) => void;
};

type CandidateAnswerTarget = {
    slotId: string;
    questionIndex: number;
    text: string;
    retrySourceAnswerAttemptId?: string | null;
};

export function useCandidateTypedAnswerMutations({
    sessionId,
    mutationBasePath = `/candidate/session/${encodeURIComponent(sessionId)}`,
    hasDurableSession,
    setAnswerDrafts,
    setAnswerSubmissions,
    setAnswerAnalysisSnapshots,
    saveBrowserDraft,
    onAnswerSubmissionSaved,
}: CandidateTypedAnswerMutationInput) {
    const [answerMutationPhases, setAnswerMutationPhases] = useState<Record<string, SessionAnswerMutationPhase>>({});
    const draftSaveTimerRef = useRef<number | null>(null);
    const draftSaveQueueRef = useRef<CandidateAnswerDraft | null>(null);
    const draftSaveDrainRef = useRef<Promise<boolean> | null>(null);
    const latestDraftRef = useRef<CandidateAnswerDraft | null>(null);
    const answerOperationSlotRef = useRef<string | null>(null);

    useEffect(() => {
        setAnswerMutationPhases({});
    }, [sessionId]);

    useEffect(() => {
        const handlePageHide = () => {
            const draft = latestDraftRef.current;
            if (!hasDurableSession || !draft) {
                return;
            }

            void fetch(`${mutationBasePath}/answer-drafts`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(toAnswerDraftRequestBody(draft)),
                keepalive: true,
            }).catch(() => undefined);
        };

        window.addEventListener("pagehide", handlePageHide);
        return () => window.removeEventListener("pagehide", handlePageHide);
    }, [hasDurableSession, mutationBasePath]);

    useEffect(() => () => {
        if (draftSaveTimerRef.current !== null) {
            window.clearTimeout(draftSaveTimerRef.current);
        }
    }, []);

    function updateAnswerDraft({ slotId, questionIndex, text }: CandidateAnswerTarget) {
        const draft = createDraft({ slotId, questionIndex, text });

        setAnswerDrafts((currentDrafts) => ({
            ...currentDrafts,
            [slotId]: draft,
        }));
        latestDraftRef.current = draft;
        setAnswerMutationPhase(slotId, "draft_dirty");

        if (!hasDurableSession) {
            saveBrowserDraft(draft);
            setAnswerMutationPhase(slotId, "draft_saved");
            return;
        }

        clearDraftSaveTimer();
        draftSaveTimerRef.current = window.setTimeout(() => {
            draftSaveTimerRef.current = null;
            void enqueueAnswerDraftSave(draft);
        }, CANDIDATE_ANSWER_DRAFT_SAVE_DELAY_MS);
    }

    async function flushAnswerDraft({ slotId, questionIndex, text }: CandidateAnswerTarget) {
        const draft = createDraft({ slotId, questionIndex, text });
        latestDraftRef.current = draft;
        clearDraftSaveTimer();

        if (!hasDurableSession) {
            saveBrowserDraft(draft);
            setAnswerMutationPhase(slotId, "draft_saved");
            return true;
        }

        return enqueueAnswerDraftSave(draft);
    }

    async function submitAnswerDraft({
        slotId,
        questionIndex,
        text,
        retrySourceAnswerAttemptId = null,
    }: CandidateAnswerTarget) {
        if (!text.trim() || answerOperationSlotRef.current === slotId) {
            return;
        }

        answerOperationSlotRef.current = slotId;

        try {
            await flushAnswerDraft({ slotId, questionIndex, text });
            setAnswerMutationPhase(slotId, "submitting");
            const response = await fetch(`${mutationBasePath}/answers`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    slotId,
                    questionIndex,
                    mode: "text",
                    text,
                    trigger: retrySourceAnswerAttemptId ? "feedback_retry" : "initial_submit",
                    supersedesAnswerAttemptId: retrySourceAnswerAttemptId,
                }),
            });
            const result = await response.json().catch(() => null) as {
                status?: string;
                answerSubmissions?: CandidateAnswerSubmissions;
            } | null;
            if (result?.status !== "answer_submit_saved" || !result.answerSubmissions) {
                setAnswerMutationPhase(slotId, "submit_failed");
                return;
            }

            setAnswerSubmissions(result.answerSubmissions);
            clearAcceptedAnswerDraft(slotId);
            setAnswerAnalysisSnapshots((currentSnapshots) => {
                const nextSnapshots = { ...currentSnapshots };
                delete nextSnapshots[slotId];
                return nextSnapshots;
            });
            onAnswerSubmissionSaved?.(slotId);
            setAnswerMutationPhase(slotId, "analyzing");
            await performAnswerAnalysis(slotId);
        } catch {
            setAnswerMutationPhase(slotId, "submit_failed");
        } finally {
            answerOperationSlotRef.current = null;
        }
    }

    async function submitVoiceTranscript({
        draft,
        transcriptText,
        retrySourceAnswerAttemptId = null,
    }: {
        draft: VoiceTranscriptDraft;
        transcriptText: string;
        retrySourceAnswerAttemptId?: string | null;
    }) {
        const normalizedTranscript = transcriptText.trim();
        if (!normalizedTranscript) {
            throw new Error("A nonblank voice transcript is required.");
        }
        if (answerOperationSlotRef.current === draft.slotId) {
            throw new Error("This answer is already being submitted.");
        }

        answerOperationSlotRef.current = draft.slotId;
        try {
            await settleTextDraftBeforeVoiceSubmission(draft.slotId);
            setAnswerMutationPhase(draft.slotId, "submitting");
            const response = await fetch(`${mutationBasePath}/answers`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": `voice-answer:${draft.sourceTranscriptionRunId}:${draft.submissionPath}`,
                },
                body: JSON.stringify({
                    slotId: draft.slotId,
                    questionIndex: draft.questionIndex,
                    mode: "voice",
                    text: normalizedTranscript,
                    sourceVoiceTranscriptionRunId: draft.sourceTranscriptionRunId,
                    voiceSubmissionPath: draft.submissionPath,
                    trigger: retrySourceAnswerAttemptId ? "feedback_retry" : "initial_submit",
                    supersedesAnswerAttemptId: retrySourceAnswerAttemptId,
                }),
            });
            const result = await response.json().catch(() => null) as {
                status?: string;
                answerSubmissions?: CandidateAnswerSubmissions;
            } | null;
            if (result?.status !== "answer_submit_saved" || !result.answerSubmissions) {
                setAnswerMutationPhase(draft.slotId, "submit_failed");
                throw new Error("Voice answer submission was not saved.");
            }

            setAnswerSubmissions(result.answerSubmissions);
            clearAcceptedAnswerDraft(draft.slotId);
            setAnswerAnalysisSnapshots((currentSnapshots) => {
                const nextSnapshots = { ...currentSnapshots };
                delete nextSnapshots[draft.slotId];
                return nextSnapshots;
            });
            onAnswerSubmissionSaved?.(draft.slotId);
            setAnswerMutationPhase(draft.slotId, "analyzing");
            await performAnswerAnalysis(draft.slotId);
        } catch (error) {
            setAnswerMutationPhase(draft.slotId, "submit_failed");
            throw error;
        } finally {
            answerOperationSlotRef.current = null;
        }
    }

    async function retryAnswerAnalysis(slotId: string) {
        if (answerOperationSlotRef.current === slotId) {
            return;
        }

        answerOperationSlotRef.current = slotId;
        setAnswerMutationPhase(slotId, "analyzing");
        try {
            await performAnswerAnalysis(slotId);
        } finally {
            answerOperationSlotRef.current = null;
        }
    }

    function enqueueAnswerDraftSave(draft: CandidateAnswerDraft) {
        draftSaveQueueRef.current = draft;
        if (draftSaveDrainRef.current) {
            return draftSaveDrainRef.current;
        }

        const drain = drainAnswerDraftSaves();
        draftSaveDrainRef.current = drain;
        void drain.finally(() => {
            if (draftSaveDrainRef.current === drain) {
                draftSaveDrainRef.current = null;
            }
        });
        return drain;
    }

    async function drainAnswerDraftSaves() {
        let latestResult = true;

        while (draftSaveQueueRef.current) {
            const draft = draftSaveQueueRef.current;
            draftSaveQueueRef.current = null;
            setAnswerMutationPhase(draft.slotId, "draft_saving");

            try {
                const response = await fetch(`${mutationBasePath}/answer-drafts`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(toAnswerDraftRequestBody(draft)),
                });
                const result = await response.json().catch(() => null) as { status?: string } | null;
                latestResult = response.ok && result?.status === "answer_draft_saved";
            } catch {
                latestResult = false;
            }

            if (!draftSaveQueueRef.current) {
                setAnswerMutationPhase(draft.slotId, latestResult ? "draft_saved" : "draft_save_failed");
            }
        }

        return latestResult;
    }

    async function performAnswerAnalysis(slotId: string) {
        try {
            const response = await fetch(
                `${mutationBasePath}/answers/${encodeURIComponent(slotId)}/analysis`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            );
            const result = await response.json().catch(() => null) as {
                status?: string;
                analysisSnapshot?: CandidateAnswerAnalysisSnapshots[string];
                analysisRecovery?: unknown;
                retryable?: boolean;
            } | null;
            if (result?.status === "answer_analysis_saved" && result.analysisSnapshot) {
                setAnswerAnalysisSnapshots((currentSnapshots) => ({
                    ...currentSnapshots,
                    [result.analysisSnapshot!.answer.slotId]: result.analysisSnapshot!,
                }));
                setAnswerMutationPhase(slotId, "analysis_ready");
                return true;
            }

            const recovery = parseCandidateAnswerAnalysisRecovery(result?.analysisRecovery);
            setAnswerMutationPhase(
                slotId,
                recovery
                    ? toAnswerMutationPhase(recovery)
                    : result?.retryable === false || result?.status === "answer_analysis_unavailable"
                        ? "analysis_unavailable"
                        : "analysis_failed",
            );
            return false;
        } catch {
            setAnswerMutationPhase(slotId, "analysis_failed");
            return false;
        }
    }

    function clearDraftSaveTimer() {
        if (draftSaveTimerRef.current !== null) {
            window.clearTimeout(draftSaveTimerRef.current);
            draftSaveTimerRef.current = null;
        }
    }

    async function settleTextDraftBeforeVoiceSubmission(slotId: string) {
        const latestDraft = latestDraftRef.current;
        if (latestDraft?.slotId !== slotId) {
            if (draftSaveDrainRef.current) {
                await draftSaveDrainRef.current;
            }
            return;
        }

        clearDraftSaveTimer();
        await enqueueAnswerDraftSave(latestDraft);
    }

    function clearAcceptedAnswerDraft(slotId: string) {
        if (latestDraftRef.current?.slotId === slotId) {
            clearDraftSaveTimer();
            latestDraftRef.current = null;
        }
        if (draftSaveQueueRef.current?.slotId === slotId) {
            draftSaveQueueRef.current = null;
        }
        setAnswerDrafts((currentDrafts) => {
            if (!(slotId in currentDrafts)) {
                return currentDrafts;
            }

            const nextDrafts = { ...currentDrafts };
            delete nextDrafts[slotId];
            return nextDrafts;
        });
    }

    function setAnswerMutationPhase(slotId: string, phase: SessionAnswerMutationPhase) {
        setAnswerMutationPhases((currentPhases) => ({
            ...currentPhases,
            [slotId]: phase,
        }));
    }

    return {
        answerMutationPhases,
        flushAnswerDraft,
        retryAnswerAnalysis,
        submitAnswerDraft,
        submitVoiceTranscript,
        updateAnswerDraft,
    };
}

function toAnswerMutationPhase(
    recovery: CandidateAnswerAnalysisRecovery,
): SessionAnswerMutationPhase {
    switch (recovery.state) {
        case "pending":
            return "analysis_pending";
        case "recoverable":
            return "analysis_recoverable";
        case "unavailable":
            return "analysis_unavailable";
        case "retryable":
        default:
            return "analysis_failed";
    }
}

function createDraft({ slotId, questionIndex, text }: CandidateAnswerTarget): CandidateAnswerDraft {
    return {
        slotId,
        questionIndex,
        mode: "text",
        text,
        updatedAt: new Date().toISOString(),
    };
}

function toAnswerDraftRequestBody(draft: CandidateAnswerDraft) {
    return {
        slotId: draft.slotId,
        questionIndex: draft.questionIndex,
        mode: draft.mode,
        text: draft.text,
    };
}
