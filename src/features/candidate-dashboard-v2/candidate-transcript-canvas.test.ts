import { describe, expect, it } from "vitest";

import {
    runFixtureEvidenceFirstEvaluator,
} from "@/features/candidate-session-v2/candidate-answer-analysis-fixture";
import type { CandidateAnswerAttemptRecord } from "@/features/candidate-session-v2/candidate-answer-history";
import type { AcceptedEvidenceFirstEvaluatorRun } from "@/features/evaluation-v2/evidence-first-evaluator-runtime";

import {
    createCandidateTranscriptCanvasProjection,
    normalizeCandidateTranscriptCanvasProjection,
} from "./candidate-transcript-canvas";
import { createCandidateTranscriptSegments } from "./candidate-transcript-segments";

describe("candidate transcript canvas projection", () => {
    it("admits only unique exact spans cited by accepted candidate-safe claims", async () => {
        const { run, attempt } = await createAcceptedFixture(
            "I organized the urgent shipment and documented the result for the next shift.",
        );

        const projection = createProjection(run, attempt);

        expect(projection).toMatchObject({
            status: "candidate_transcript_canvas_v1",
            answerAttemptId: "attempt-1",
            evaluationRunId: "run-1",
            inputFingerprint: run.inputFingerprint,
            annotations: [{
                basis: { kind: "span", spanIds: ["fixture-direct-answer"] },
                markerIds: ["direct_answer"],
                indicators: [
                    expect.objectContaining({ kind: "acknowledgement" }),
                    expect.objectContaining({ kind: "primary_strength" }),
                ],
            }],
        });
        expect(projection?.transcriptFingerprint).toMatch(/^[a-f0-9]{64}$/);
    });

    it("omits an ambiguous repeated quote without rejecting accepted coaching", async () => {
        const answer = "I checked the count, then I checked the count again.";
        const { run, attempt } = await createAcceptedFixture(answer);
        const ambiguous = cloneRun(run);
        ambiguous.accepted.extraction.evidenceSpans = [{
            id: "fixture-direct-answer",
            marker: "direct_answer",
            quote: "I checked the count",
            start: 0,
            end: "I checked the count".length,
        }];

        const projection = createProjection(ambiguous, attempt);

        expect(projection).not.toBeNull();
        expect(projection?.annotations).toEqual([]);
        expect(projection?.primaryGap).not.toBeNull();
    });

    it("preserves identical and overlapping ranges and reconstructs the transcript exactly", async () => {
        const answer = "I mapped the issue, chose safety first, and explained the tradeoff.";
        const { run, attempt } = await createAcceptedFixture(answer);
        const overlapping = cloneRun(run);
        overlapping.accepted.extraction.evidenceSpans = [
            { id: "span-context", marker: "context", quote: "mapped the issue", start: 2, end: 18 },
            { id: "span-framing", marker: "problem_framing", quote: "mapped the issue", start: 2, end: 18 },
            { id: "span-priority", marker: "priority", quote: "issue, chose safety first", start: 13, end: 38 },
        ];
        overlapping.accepted.feedback.claimEvidence = {
            acknowledgementSpanIds: ["span-context", "span-priority"],
            primaryStrengthSpanIds: ["span-framing"],
        };

        const projection = createProjection(overlapping, attempt)!;
        const segments = createCandidateTranscriptSegments(answer, projection.annotations);

        expect(projection.annotations).toHaveLength(2);
        expect(projection.annotations[0]).toMatchObject({
            basis: { spanIds: ["span-context", "span-framing"] },
            markerIds: ["context", "problem_framing"],
        });
        expect(segments.map((segment) => segment.text).join("")).toBe(answer);
        expect(segments.some((segment) => segment.annotationIds.length === 2)).toBe(true);
    });

    it("coalesces overlapping spans for the same claim without highlighting edge punctuation", async () => {
        const answer = "I studied the training materials and coding manuals.";
        const { run, attempt } = await createAcceptedFixture(answer);
        const overlapping = cloneRun(run);
        const firstQuote = "I studied the training materials";
        const secondQuote = "training materials and coding manuals.";
        const secondStart = answer.indexOf(secondQuote);
        overlapping.accepted.extraction.evidenceSpans = [
            {
                id: "span-direct",
                marker: "direct_answer",
                quote: firstQuote,
                start: 0,
                end: firstQuote.length,
            },
            {
                id: "span-detail",
                marker: "specific_detail",
                quote: secondQuote,
                start: secondStart,
                end: secondStart + secondQuote.length,
            },
        ];
        overlapping.accepted.feedback.claimEvidence = {
            acknowledgementSpanIds: ["span-direct", "span-detail"],
            primaryStrengthSpanIds: [],
        };

        const projection = createProjection(overlapping, attempt)!;
        const segments = createCandidateTranscriptSegments(answer, projection.annotations);

        expect(projection.annotations).toHaveLength(1);
        expect(projection.annotations[0]).toMatchObject({
            quote: answer.slice(0, -1),
            basis: { spanIds: ["span-direct", "span-detail"] },
            markerIds: ["direct_answer", "specific_detail"],
        });
        expect(segments.at(-1)).toMatchObject({ text: ".", annotationIds: [] });
        expect(segments.map((segment) => segment.text).join("")).toBe(answer);
    });

    it("normalizes stored overlapping annotations through the same candidate-visible rule", async () => {
        const answer = "I studied the training materials and coding manuals.";
        const { run, attempt } = await createAcceptedFixture(answer);
        const projection = createProjection(run, attempt)!;
        const firstQuote = "I studied the training materials";
        const secondQuote = "training materials and coding manuals.";
        const secondStart = answer.indexOf(secondQuote);
        const sharedIndicator = {
            kind: "acknowledgement" as const,
            label: "Coach noticed",
            message: run.accepted.candidateProjection.acknowledgement,
        };

        const normalized = normalizeCandidateTranscriptCanvasProjection({
            ...projection,
            annotations: [
                {
                    id: "stored-direct",
                    quote: firstQuote,
                    start: 0,
                    end: firstQuote.length,
                    basis: { kind: "span", spanIds: ["span-direct"] },
                    markerIds: ["direct_answer"],
                    indicators: [sharedIndicator],
                },
                {
                    id: "stored-detail",
                    quote: secondQuote,
                    start: secondStart,
                    end: secondStart + secondQuote.length,
                    basis: { kind: "span", spanIds: ["span-detail"] },
                    markerIds: ["specific_detail"],
                    indicators: [sharedIndicator],
                },
            ],
        }, {
            candidateAnswerAttemptId: attempt.candidateAnswerAttemptId,
            text: answer,
        });

        expect(normalized?.annotations).toHaveLength(1);
        expect(normalized?.annotations[0]).toMatchObject({
            quote: answer.slice(0, -1),
            markerIds: ["direct_answer", "specific_detail"],
        });
    });

    it("uses UTF-16 offsets without dropping emoji or smart punctuation", async () => {
        const answer = "I said “yes” 👍, then documented the result.";
        const { run, attempt } = await createAcceptedFixture(answer);
        const unicode = cloneRun(run);
        const quote = "👍, then documented";
        const start = answer.indexOf(quote);
        unicode.accepted.extraction.evidenceSpans = [{
            id: "unicode-span",
            marker: "specific_detail",
            quote,
            start,
            end: start + quote.length,
        }];
        unicode.accepted.feedback.claimEvidence = {
            acknowledgementSpanIds: ["unicode-span"],
            primaryStrengthSpanIds: [],
        };

        const projection = createProjection(unicode, attempt)!;
        const segments = createCandidateTranscriptSegments(answer, projection.annotations);

        expect(segments.map((segment) => segment.text).join("")).toBe(answer);
        expect(projection.annotations[0]?.quote).toBe(quote);
    });

    it("suppresses inline evidence for sensitive disclosure and keeps only a professional reframe", async () => {
        const { run, attempt } = await createAcceptedFixture(
            "I left because of a private health matter and now want a stable schedule.",
        );
        const sensitive = cloneRun(run);
        sensitive.accepted.extraction.answerUsability = {
            status: "sensitive_disclosure",
            reasonCode: "private_detail",
        };
        sensitive.accepted.extraction.sensitiveContentFlags = ["health_or_disability_disclosure"];
        sensitive.accepted.patternGap = {
            id: "privacy_reframe",
            severity: "high",
            upgrade: "Keep the answer professional without sharing private personal details.",
            redoPattern: ["professional reason", "forward-looking transition", "role connection"],
            source: "answer_usability",
        };

        const projection = createProjection(sensitive, attempt);

        expect(projection?.annotations).toEqual([]);
        expect(projection?.primaryGap).toBeNull();
        expect(projection?.wholeAnswerIndicators).toEqual([
            expect.objectContaining({
                basis: { kind: "whole_answer", signalId: "professional_reframe" },
                label: "Keep it professional",
            }),
        ]);
        expect(JSON.stringify(projection)).not.toContain("health_or_disability");
    });

    it("does not expose an ungrounded technical contradiction or accept stale provenance", async () => {
        const { run, attempt } = await createAcceptedFixture(
            "I would inspect the process and explain why the step matters.",
        );
        const ungrounded = cloneRun(run);
        ungrounded.accepted.patternGap = {
            id: "technical_accuracy_contradicted",
            severity: "high",
            upgrade: "Correct the core concept before adding more detail.",
            redoPattern: ["direct answer", "why it works", "practical example"],
            source: "category_lens",
        };

        expect(createProjection(ungrounded, attempt)?.primaryGap).toBeNull();
        expect(createCandidateTranscriptCanvasProjection({
            acceptedRun: run,
            evaluation: {
                evaluationRunId: "different-run",
                answerAttemptId: attempt.candidateAnswerAttemptId,
                inputFingerprint: run.inputFingerprint,
            },
            answerAttempt: attempt,
        })).toBeNull();
    });

    it("rejects a projection when its transcript fingerprint or exact range becomes stale", async () => {
        const { run, attempt } = await createAcceptedFixture(
            "I organized the shipment and documented the result.",
        );
        const projection = createProjection(run, attempt)!;

        expect(normalizeCandidateTranscriptCanvasProjection(projection, {
            candidateAnswerAttemptId: attempt.candidateAnswerAttemptId,
            text: `${attempt.answerText} changed`,
        })).toBeNull();
        expect(normalizeCandidateTranscriptCanvasProjection({
            ...projection,
            annotations: projection.annotations.map((annotation) => ({ ...annotation, end: annotation.end - 1 })),
        }, {
            candidateAnswerAttemptId: attempt.candidateAnswerAttemptId,
            text: attempt.answerText,
        })).toBeNull();
    });
});

async function createAcceptedFixture(answerText: string) {
    const attempt = createAttempt(answerText);
    const run = await runFixtureEvidenceFirstEvaluator({
        status: "answer_analysis_provider_requested",
        provider: "candidate_v2_answer_evaluator",
        requestedAt: "2026-07-19T12:00:00.000Z",
        answer: {
            slotId: "slot-1",
            questionIndex: 0,
            mode: "text",
            text: answerText,
            submittedAt: attempt.submittedAt,
            answerAttemptId: attempt.candidateAnswerAttemptId,
            attemptNumber: attempt.attemptNumber,
            trigger: attempt.trigger,
        },
        question: {
            slotId: "slot-1",
            questionIndex: 0,
            category: "screening",
            questionText: "What interests you about this role?",
            plannedPurpose: "Understand role interest and alignment.",
        },
        setupContext: {
            targetRole: "Material Handler",
            jobDescription: "Move and document materials safely.",
            resumeText: null,
            interviewStage: "screening",
            questionCount: 1,
        },
    }, { evaluationRunId: "run-1" });
    return { run, attempt };
}

function createProjection(run: AcceptedEvidenceFirstEvaluatorRun, answerAttempt: CandidateAnswerAttemptRecord) {
    return createCandidateTranscriptCanvasProjection({
        acceptedRun: run,
        evaluation: {
            evaluationRunId: run.evaluationRunId,
            answerAttemptId: answerAttempt.candidateAnswerAttemptId,
            inputFingerprint: run.inputFingerprint,
        },
        answerAttempt,
    });
}

function createAttempt(answerText: string): CandidateAnswerAttemptRecord {
    return {
        candidateAnswerAttemptId: "attempt-1",
        candidatePracticeSessionId: "session-1",
        candidateProfileId: "candidate-1",
        questionSlotId: "slot-1",
        questionIndex: 0,
        attemptNumber: 1,
        trigger: "initial_submit",
        supersedesCandidateAnswerAttemptId: null,
        mode: "text",
        answerText,
        submittedAt: "2026-07-19T11:59:00.000Z",
        idempotencyKey: "attempt-key-1",
        payloadFingerprint: "answer-payload-1",
        sourceVoiceTranscriptionRunId: null,
        voiceSubmissionPath: null,
        voiceTranscriptEdited: null,
        createdAt: "2026-07-19T11:59:00.000Z",
    };
}

function cloneRun(run: AcceptedEvidenceFirstEvaluatorRun) {
    return JSON.parse(JSON.stringify(run)) as AcceptedEvidenceFirstEvaluatorRun;
}
