import type { CandidateTranscriptAnnotation } from "./candidate-transcript-canvas";

export type CandidateTranscriptSegment = {
    id: string;
    text: string;
    start: number;
    end: number;
    annotationIds: string[];
};

export function createCandidateTranscriptSegments(
    answerText: string,
    annotations: CandidateTranscriptAnnotation[],
): CandidateTranscriptSegment[] {
    const boundaries = new Set<number>([0, answerText.length]);
    annotations.forEach((annotation) => {
        if (
            annotation.start >= 0
            && annotation.end > annotation.start
            && annotation.end <= answerText.length
            && answerText.slice(annotation.start, annotation.end) === annotation.quote
        ) {
            boundaries.add(annotation.start);
            boundaries.add(annotation.end);
        }
    });
    const ordered = Array.from(boundaries).sort((left, right) => left - right);
    const segments: CandidateTranscriptSegment[] = [];
    for (let index = 0; index < ordered.length - 1; index += 1) {
        const start = ordered[index];
        const end = ordered[index + 1];
        if (end <= start) continue;
        const annotationIds = annotations
            .filter((annotation) => annotation.start <= start && annotation.end >= end)
            .map((annotation) => annotation.id)
            .sort();
        const previous = segments.at(-1);
        if (previous && arraysEqual(previous.annotationIds, annotationIds)) {
            previous.text += answerText.slice(start, end);
            previous.end = end;
            continue;
        }
        segments.push({
            id: `segment-${start}-${end}`,
            text: answerText.slice(start, end),
            start,
            end,
            annotationIds,
        });
    }
    return segments;
}

function arraysEqual(left: string[], right: string[]) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}
