import { createHash } from "node:crypto";

import type { CandidateAnswerAttemptRecord } from "@/features/candidate-session-v2/candidate-answer-history";
import { EVIDENCE_MARKERS } from "@/features/evaluation-v2/evidence-first-evaluator-contract";
import type {
    AcceptedEvidenceFirstEvaluatorRun,
    CompatiblePersistedAcceptedEvidenceFirstEvaluatorRun,
} from "@/features/evaluation-v2/evidence-first-evaluator-runtime";

import type { CandidateEvidenceMarkerId } from "./candidate-transcript-canvas-labels";

export type CandidateSignalBasis =
    | { kind: "span"; spanIds: string[] }
    | { kind: "whole_answer"; signalId: string }
    | { kind: "missing_expected_signal"; signalId: string };

export type CandidateTranscriptIndicator = {
    kind: "acknowledgement" | "primary_strength";
    label: string;
    message: string;
};

export type CandidateTranscriptAnnotation = {
    id: string;
    quote: string;
    start: number;
    end: number;
    basis: Extract<CandidateSignalBasis, { kind: "span" }>;
    markerIds: CandidateEvidenceMarkerId[];
    indicators: CandidateTranscriptIndicator[];
};

export type CandidateWholeAnswerIndicator = {
    id: string;
    basis: Extract<CandidateSignalBasis, { kind: "whole_answer" }>;
    label: string;
    message: string;
};

export type CandidateTranscriptGap = {
    id: string;
    basis: Extract<CandidateSignalBasis, { kind: "missing_expected_signal" }>;
    label: "Try next";
    message: string;
    suggestedShape: string[];
};

export type CandidateTranscriptCanvasProjection = {
    status: "candidate_transcript_canvas_v1";
    answerAttemptId: string;
    evaluationRunId: string;
    inputFingerprint: string;
    transcriptFingerprint: string;
    annotations: CandidateTranscriptAnnotation[];
    wholeAnswerIndicators: CandidateWholeAnswerIndicator[];
    primaryGap: CandidateTranscriptGap | null;
};

type CandidateTranscriptProjectionSource = {
    acceptedRun: CandidateTranscriptAcceptedRun;
    evaluation: {
        evaluationRunId: string;
        answerAttemptId: string;
        inputFingerprint: string;
    };
    answerAttempt: CandidateAnswerAttemptRecord;
};

type CandidateTranscriptAcceptedRun = AcceptedEvidenceFirstEvaluatorRun
    | CompatiblePersistedAcceptedEvidenceFirstEvaluatorRun;

const MARKER_IDS = new Set<string>(EVIDENCE_MARKERS);

export function createCandidateTranscriptCanvasProjection({
    acceptedRun,
    evaluation,
    answerAttempt,
}: CandidateTranscriptProjectionSource): CandidateTranscriptCanvasProjection | null {
    if (
        acceptedRun.evaluationRunId !== evaluation.evaluationRunId
        || acceptedRun.inputFingerprint !== evaluation.inputFingerprint
        || evaluation.answerAttemptId !== answerAttempt.candidateAnswerAttemptId
    ) {
        return null;
    }

    const answerText = answerAttempt.answerText;
    const extraction = acceptedRun.accepted.extraction;
    const candidateFeedback = acceptedRun.accepted.candidateProjection;
    const claimEvidence = acceptedRun.accepted.feedback.claimEvidence;
    const sensitive = extraction.answerUsability.status === "sensitive_disclosure"
        || extraction.sensitiveContentFlags.length > 0;
    const acknowledgementSpanIds = new Set(claimEvidence.acknowledgementSpanIds);
    const primaryStrengthSpanIds = new Set(claimEvidence.primaryStrengthSpanIds);
    const spanIdCounts = countValues(extraction.evidenceSpans.map((span) => span.id));
    const admitted = sensitive ? [] : extraction.evidenceSpans.flatMap((span) => {
        const indicators: CandidateTranscriptIndicator[] = [];
        if (acknowledgementSpanIds.has(span.id)) {
            indicators.push({
                kind: "acknowledgement",
                label: "Coach noticed",
                message: candidateFeedback.acknowledgement,
            });
        }
        if (primaryStrengthSpanIds.has(span.id) && candidateFeedback.primaryStrength) {
            indicators.push({
                kind: "primary_strength",
                label: "Working well",
                message: candidateFeedback.primaryStrength,
            });
        }
        if (
            indicators.length === 0
            || spanIdCounts.get(span.id) !== 1
            || !MARKER_IDS.has(span.marker)
            || !isExactUniqueSpan(answerText, span)
        ) {
            return [];
        }
        return [{ span, indicators }];
    });

    const annotations = groupAdmittedSpans(answerText, admitted);
    const wholeAnswerIndicators = createWholeAnswerIndicators(acceptedRun);
    const primaryGap = createPrimaryGap(acceptedRun);

    return {
        status: "candidate_transcript_canvas_v1",
        answerAttemptId: answerAttempt.candidateAnswerAttemptId,
        evaluationRunId: evaluation.evaluationRunId,
        inputFingerprint: evaluation.inputFingerprint,
        transcriptFingerprint: createTranscriptFingerprint(answerText),
        annotations,
        wholeAnswerIndicators,
        primaryGap,
    };
}

export function normalizeCandidateTranscriptCanvasProjection(
    value: unknown,
    answer: { candidateAnswerAttemptId: string; text: string },
): CandidateTranscriptCanvasProjection | null {
    if (
        !isRecord(value)
        || !hasExactKeys(value, [
            "status",
            "answerAttemptId",
            "evaluationRunId",
            "inputFingerprint",
            "transcriptFingerprint",
            "annotations",
            "wholeAnswerIndicators",
            "primaryGap",
        ])
        || value.status !== "candidate_transcript_canvas_v1"
        || readString(value.answerAttemptId) !== answer.candidateAnswerAttemptId
        || !readString(value.evaluationRunId)
        || !readString(value.inputFingerprint)
        || readString(value.transcriptFingerprint) !== createTranscriptFingerprint(answer.text)
        || !Array.isArray(value.annotations)
        || !Array.isArray(value.wholeAnswerIndicators)
    ) {
        return null;
    }

    const normalizedAnnotations = value.annotations.flatMap((annotation) => {
        const normalized = normalizeAnnotation(annotation, answer.text);
        return normalized ? [normalized] : [];
    });
    if (
        normalizedAnnotations.length !== value.annotations.length
        || hasDuplicateIds(normalizedAnnotations)
    ) return null;
    const annotations = normalizeCandidateVisibleAnnotations(answer.text, normalizedAnnotations);

    const wholeAnswerIndicators = value.wholeAnswerIndicators.flatMap((indicator) => {
        const normalized = normalizeWholeAnswerIndicator(indicator);
        return normalized ? [normalized] : [];
    });
    if (
        wholeAnswerIndicators.length !== value.wholeAnswerIndicators.length
        || hasDuplicateIds(wholeAnswerIndicators)
    ) return null;

    const primaryGap = value.primaryGap === null ? null : normalizePrimaryGap(value.primaryGap);
    if (value.primaryGap !== null && !primaryGap) return null;

    return {
        status: "candidate_transcript_canvas_v1",
        answerAttemptId: answer.candidateAnswerAttemptId,
        evaluationRunId: readString(value.evaluationRunId)!,
        inputFingerprint: readString(value.inputFingerprint)!,
        transcriptFingerprint: createTranscriptFingerprint(answer.text),
        annotations,
        wholeAnswerIndicators,
        primaryGap,
    };
}

function groupAdmittedSpans(
    answerText: string,
    admitted: Array<{
        span: CandidateTranscriptAcceptedRun["accepted"]["extraction"]["evidenceSpans"][number];
        indicators: CandidateTranscriptIndicator[];
    }>,
): CandidateTranscriptAnnotation[] {
    const groups = new Map<string, CandidateTranscriptAnnotation>();
    admitted.forEach(({ span, indicators }) => {
        const visibleSpan = trimCandidateVisibleSpan(answerText, span);
        if (!visibleSpan) return;
        const key = `${visibleSpan.start}:${visibleSpan.end}:${visibleSpan.quote}`;
        const existing = groups.get(key);
        if (existing) {
            existing.basis.spanIds.push(span.id);
            if (!existing.markerIds.includes(span.marker)) existing.markerIds.push(span.marker);
            indicators.forEach((indicator) => {
                if (!existing.indicators.some((item) => item.kind === indicator.kind && item.message === indicator.message)) {
                    existing.indicators.push(indicator);
                }
            });
            return;
        }
        groups.set(key, {
            id: `annotation-${visibleSpan.start}-${visibleSpan.end}`,
            quote: visibleSpan.quote,
            start: visibleSpan.start,
            end: visibleSpan.end,
            basis: { kind: "span", spanIds: [span.id] },
            markerIds: [span.marker],
            indicators: [...indicators],
        });
    });
    return normalizeCandidateVisibleAnnotations(answerText, Array.from(groups.values()));
}

function normalizeCandidateVisibleAnnotations(
    answerText: string,
    annotations: CandidateTranscriptAnnotation[],
): CandidateTranscriptAnnotation[] {
    const visible = annotations.flatMap((annotation) => {
        const span = trimCandidateVisibleSpan(answerText, annotation);
        return span ? [{ ...annotation, ...span }] : [];
    });
    const byClaim = new Map<string, CandidateTranscriptAnnotation[]>();
    visible.forEach((annotation) => {
        const signature = createIndicatorSignature(annotation.indicators);
        byClaim.set(signature, [...(byClaim.get(signature) ?? []), annotation]);
    });

    const coalesced = Array.from(byClaim.values()).flatMap((group) => {
        const ordered = [...group].sort((left, right) => left.start - right.start || left.end - right.end);
        const merged: CandidateTranscriptAnnotation[] = [];
        ordered.forEach((annotation) => {
            const previous = merged.at(-1);
            if (!previous || previous.end < annotation.start) {
                merged.push(cloneAnnotation(annotation));
                return;
            }
            const start = Math.min(previous.start, annotation.start);
            const end = Math.max(previous.end, annotation.end);
            const quote = answerText.slice(start, end);
            if (!isExactUniqueSpan(answerText, { quote, start, end })) {
                merged.push(cloneAnnotation(annotation));
                return;
            }
            previous.start = start;
            previous.end = end;
            previous.quote = quote;
            previous.basis.spanIds = uniqueValues([
                ...previous.basis.spanIds,
                ...annotation.basis.spanIds,
            ]);
            previous.markerIds = uniqueValues([
                ...previous.markerIds,
                ...annotation.markerIds,
            ]);
        });
        return merged;
    });

    return coalesced
        .sort((left, right) => left.start - right.start || left.end - right.end)
        .map((annotation) => ({
            ...annotation,
            id: createAnnotationId(annotation),
        }));
}

function cloneAnnotation(annotation: CandidateTranscriptAnnotation): CandidateTranscriptAnnotation {
    return {
        ...annotation,
        basis: { kind: "span", spanIds: [...annotation.basis.spanIds] },
        markerIds: [...annotation.markerIds],
        indicators: annotation.indicators.map((indicator) => ({ ...indicator })),
    };
}

function trimCandidateVisibleSpan(
    answerText: string,
    span: { quote: string; start: number; end: number },
) {
    let leading = 0;
    let trailing = span.quote.length;
    while (leading < trailing && isCandidateVisibleEdgeCharacter(span.quote[leading])) leading += 1;
    while (trailing > leading && isCandidateVisibleEdgeCharacter(span.quote[trailing - 1])) trailing -= 1;
    if (leading === trailing) return null;
    const candidate = {
        quote: span.quote.slice(leading, trailing),
        start: span.start + leading,
        end: span.start + trailing,
    };
    return isExactUniqueSpan(answerText, candidate)
        ? candidate
        : { quote: span.quote, start: span.start, end: span.end };
}

function isCandidateVisibleEdgeCharacter(value: string | undefined) {
    return Boolean(value && /[\s.,;:!?…]/.test(value));
}

function createIndicatorSignature(indicators: CandidateTranscriptIndicator[]) {
    return indicators
        .map((indicator) => `${indicator.kind}\u0000${indicator.label}\u0000${indicator.message}`)
        .sort()
        .join("\u0001");
}

function createAnnotationId(annotation: CandidateTranscriptAnnotation) {
    const basisHash = createHash("sha256")
        .update([...annotation.basis.spanIds].sort().join("|"))
        .digest("hex")
        .slice(0, 8);
    return `annotation-${annotation.start}-${annotation.end}-${basisHash}`;
}

function uniqueValues<T>(values: T[]) {
    return Array.from(new Set(values));
}

function createWholeAnswerIndicators(
    run: CandidateTranscriptAcceptedRun,
): CandidateWholeAnswerIndicator[] {
    const extraction = run.accepted.extraction;
    const feedback = run.accepted.candidateProjection;
    const indicators: CandidateWholeAnswerIndicator[] = [];
    const add = (signalId: string, label: string, message: string) => {
        if (indicators.some((indicator) => indicator.basis.signalId === signalId)) return;
        indicators.push({
            id: `whole-answer-${signalId}`,
            basis: { kind: "whole_answer", signalId },
            label,
            message,
        });
    };

    if (
        extraction.answerUsability.status === "sensitive_disclosure"
        || extraction.sensitiveContentFlags.length > 0
    ) {
        add(
            "professional_reframe",
            "Keep it professional",
            feedback.biggestUpgrade ?? run.accepted.patternGap.upgrade,
        );
        return indicators;
    }
    if (extraction.answerUsability.status === "off_topic" || extraction.answerUsability.status === "non_answer") {
        add("answer_alignment", "Answer alignment", "Start by answering the question directly, then add support.");
    }
    if (extraction.answerUsability.status === "transcription_unclear") {
        add("clear_transcription", "Capture a clear answer", "Try capturing this response again before working on its content.");
    }
    if (extraction.observableMarkers.isVeryShort) {
        add("very_short", "Add support", "This response needs more support before a useful answer pattern is clear.");
    }
    if (extraction.observableMarkers.isOverlyLong) {
        add("overly_long", "Clarify the main point", "The response may make its main point difficult to place.");
    }
    return indicators;
}

function createPrimaryGap(run: CandidateTranscriptAcceptedRun): CandidateTranscriptGap | null {
    const patternGap = run.accepted.patternGap;
    if (
        patternGap.id === "reinforce_effective_pattern"
        || run.accepted.extraction.answerUsability.status === "sensitive_disclosure"
    ) {
        return null;
    }
    if (
        patternGap.id === "technical_accuracy_contradicted"
        && (
            run.accepted.extraction.technicalAccuracy.status !== "contradicted"
            || run.accepted.extraction.technicalAccuracy.referenceConceptIds.length === 0
            || !run.accepted.verification.output?.supported
        )
    ) {
        return null;
    }
    return {
        id: `gap-${patternGap.id}`,
        basis: { kind: "missing_expected_signal", signalId: patternGap.id },
        label: "Try next",
        message: run.accepted.candidateProjection.biggestUpgrade ?? patternGap.upgrade,
        suggestedShape: [...patternGap.redoPattern],
    };
}

function normalizeAnnotation(value: unknown, answerText: string): CandidateTranscriptAnnotation | null {
    if (
        !isRecord(value)
        || !hasExactKeys(value, ["id", "quote", "start", "end", "basis", "markerIds", "indicators"])
        || !readString(value.id)
        || !readExactNonBlankString(value.quote)
        || !isNonNegativeInteger(value.start)
        || !isPositiveInteger(value.end)
        || !isSpanBasis(value.basis)
        || !Array.isArray(value.markerIds)
        || value.markerIds.length === 0
        || !value.markerIds.every((markerId) => typeof markerId === "string" && MARKER_IDS.has(markerId))
        || !Array.isArray(value.indicators)
        || value.indicators.length === 0
    ) return null;

    const indicators = value.indicators.flatMap((indicator) => {
        const normalized = normalizeTranscriptIndicator(indicator);
        return normalized ? [normalized] : [];
    });
    if (indicators.length !== value.indicators.length) return null;

    const span = {
        quote: readExactNonBlankString(value.quote)!,
        start: value.start,
        end: value.end,
    };
    if (!isExactUniqueSpan(answerText, span)) return null;

    return {
        id: readString(value.id)!,
        quote: span.quote,
        start: span.start,
        end: span.end,
        basis: value.basis,
        markerIds: value.markerIds as CandidateEvidenceMarkerId[],
        indicators,
    };
}

function normalizeTranscriptIndicator(value: unknown): CandidateTranscriptIndicator | null {
    if (
        !isRecord(value)
        || !hasExactKeys(value, ["kind", "label", "message"])
        || (value.kind !== "acknowledgement" && value.kind !== "primary_strength")
        || !readString(value.label)
        || !readString(value.message)
    ) return null;
    return {
        kind: value.kind,
        label: readString(value.label)!,
        message: readString(value.message)!,
    };
}

function normalizeWholeAnswerIndicator(value: unknown): CandidateWholeAnswerIndicator | null {
    if (
        !isRecord(value)
        || !hasExactKeys(value, ["id", "basis", "label", "message"])
        || !readString(value.id)
        || !isWholeAnswerBasis(value.basis)
        || !readString(value.label)
        || !readString(value.message)
    ) return null;
    return {
        id: readString(value.id)!,
        basis: value.basis,
        label: readString(value.label)!,
        message: readString(value.message)!,
    };
}

function normalizePrimaryGap(value: unknown): CandidateTranscriptGap | null {
    if (
        !isRecord(value)
        || !hasExactKeys(value, ["id", "basis", "label", "message", "suggestedShape"])
        || !readString(value.id)
        || !isMissingSignalBasis(value.basis)
        || value.label !== "Try next"
        || !readString(value.message)
        || !Array.isArray(value.suggestedShape)
        || value.suggestedShape.length < 2
        || !value.suggestedShape.every((item) => Boolean(readString(item)))
    ) return null;
    return {
        id: readString(value.id)!,
        basis: value.basis,
        label: "Try next",
        message: readString(value.message)!,
        suggestedShape: value.suggestedShape as string[],
    };
}

function isExactUniqueSpan(
    answerText: string,
    span: { quote: string; start: number; end: number },
) {
    return span.end > span.start
        && span.end <= answerText.length
        && answerText.slice(span.start, span.end) === span.quote
        && countExactOccurrences(answerText, span.quote) === 1;
}

function countExactOccurrences(value: string, needle: string) {
    if (!needle) return 0;
    let count = 0;
    let cursor = 0;
    while (cursor <= value.length - needle.length) {
        const index = value.indexOf(needle, cursor);
        if (index === -1) break;
        count += 1;
        cursor = index + 1;
    }
    return count;
}

function createTranscriptFingerprint(answerText: string) {
    return createHash("sha256").update(answerText).digest("hex");
}

function countValues(values: string[]) {
    const counts = new Map<string, number>();
    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return counts;
}

function hasDuplicateIds(values: Array<{ id: string }>) {
    return new Set(values.map((value) => value.id)).size !== values.length;
}

function isSpanBasis(value: unknown): value is Extract<CandidateSignalBasis, { kind: "span" }> {
    return isRecord(value)
        && hasExactKeys(value, ["kind", "spanIds"])
        && value.kind === "span"
        && Array.isArray(value.spanIds)
        && value.spanIds.length > 0
        && value.spanIds.every((item) => Boolean(readString(item)));
}

function isWholeAnswerBasis(value: unknown): value is Extract<CandidateSignalBasis, { kind: "whole_answer" }> {
    return isRecord(value)
        && hasExactKeys(value, ["kind", "signalId"])
        && value.kind === "whole_answer"
        && Boolean(readString(value.signalId));
}

function isMissingSignalBasis(value: unknown): value is Extract<CandidateSignalBasis, { kind: "missing_expected_signal" }> {
    return isRecord(value)
        && hasExactKeys(value, ["kind", "signalId"])
        && value.kind === "missing_expected_signal"
        && Boolean(readString(value.signalId));
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readExactNonBlankString(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
}

function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}
