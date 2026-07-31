import { renderHook, waitFor } from "@testing-library/react";
import { act, useState } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import type { CandidateAnswerAnalysisSnapshots } from "./candidate-provisional-session-store";
import type {
    CandidateAnswerDrafts,
    CandidateAnswerSubmissions,
} from "./candidate-answer-lifecycle";
import { useCandidateTypedAnswerMutations } from "./useCandidateTypedAnswerMutations";

beforeEach(() => {
    vi.unstubAllGlobals();
});

it("settles the typed draft before voice submission and clears it after acceptance", async () => {
    const requestUrls: string[] = [];
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        requestUrls.push(url);
        if (url.endsWith("/answer-drafts")) {
            expect(JSON.parse(String(init?.body))).toMatchObject({
                mode: "text",
                text: "This typed draft must remain separate.",
            });
            return Response.json({ status: "answer_draft_saved" });
        }
        if (url.endsWith("/answers")) {
            expect(JSON.parse(String(init?.body))).toMatchObject({
                mode: "voice",
                text: "This voice transcript is the submitted answer.",
            });
            return Response.json({
                status: "answer_submit_saved",
                answerSubmissions: {
                    "slot-1": {
                        slotId: "slot-1",
                        questionIndex: 0,
                        mode: "voice",
                        text: "This voice transcript is the submitted answer.",
                        submittedAt: "2026-07-29T23:00:00.000Z",
                        status: "pending_analysis",
                    },
                },
            }, { status: 202 });
        }
        if (url.endsWith("/analysis")) {
            return Response.json({
                status: "answer_analysis_unavailable",
                retryable: false,
            }, { status: 503 });
        }
        throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { result } = renderHook(() => {
        const [answerDrafts, setAnswerDrafts] = useState<CandidateAnswerDrafts>({});
        const [, setAnswerSubmissions] = useState<CandidateAnswerSubmissions>({});
        const [, setAnswerAnalysisSnapshots] = useState<CandidateAnswerAnalysisSnapshots>({});
        const mutations = useCandidateTypedAnswerMutations({
            sessionId: "session-1",
            hasDurableSession: true,
            setAnswerDrafts,
            setAnswerSubmissions,
            setAnswerAnalysisSnapshots,
            saveBrowserDraft: vi.fn(),
        });

        return { answerDrafts, mutations };
    });

    act(() => {
        result.current.mutations.updateAnswerDraft({
            slotId: "slot-1",
            questionIndex: 0,
            text: "This typed draft must remain separate.",
        });
    });

    await act(async () => {
        await result.current.mutations.submitVoiceTranscript({
            draft: {
                status: "voice_transcript_draft",
                slotId: "slot-1",
                questionIndex: 0,
                transcriptText: "This voice transcript is the submitted answer.",
                sourceTranscriptionRunId: "voice-run-1",
                submissionPath: "quick_submit",
                updatedAt: "2026-07-29T22:59:00.000Z",
            },
            transcriptText: "This voice transcript is the submitted answer.",
        });
    });

    expect(requestUrls).toEqual([
        "/candidate/session/session-1/answer-drafts",
        "/candidate/session/session-1/answers",
        "/candidate/session/session-1/answers/slot-1/analysis",
    ]);
    await waitFor(() => expect(result.current.answerDrafts).toEqual({}));
});
