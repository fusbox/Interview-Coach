import { describe, expect, it } from "vitest";

import type { CandidateCoachUpdateArtifactRecord } from "./candidate-coach-update-artifact";
import { createCandidateCoachUpdateDetail } from "./candidate-coach-update-detail";

describe("candidate Coach Update detail contract", () => {
    it("derives practiced-only detail from a completed candidate-safe artifact", () => {
        const detail = createCandidateCoachUpdateDetail(createArtifact());

        expect(detail).toMatchObject({
            status: "candidate_coach_update_detail_ready",
            candidatePracticeSessionId: "session-1",
            targetRole: "Material Handler I",
            answeredCount: 1,
            questionCount: 1,
            reviewPosture: "fully_reviewable",
            summary: "I reviewed your practiced answer.",
            primaryFocus: "Add the result of the inventory count.",
        });
        expect(detail?.items).toEqual([
            expect.objectContaining({
                questionKey: "slot-1",
                evidenceStatus: "practiced",
                answer: expect.objectContaining({ text: expect.stringContaining("shipment records") }),
                transcriptCanvas: null,
                coachRead: expect.objectContaining({
                    nextPracticeFocus: "Add the result of the inventory count.",
                }),
                comparison: expect.objectContaining({ kind: "first_practice" }),
                actionPosture: {
                    kind: "review_coaching",
                    label: "Review coach feedback",
                    reason: "This answer has accepted coaching ready.",
                },
            }),
        ]);
        expect(JSON.stringify(detail)).not.toContain("slot-2");
    });

    it("does not expose raw scores, legacy fields, or durable dashboard conclusions", () => {
        const detail = createCandidateCoachUpdateDetail(createArtifact());

        expect(JSON.stringify(detail)).not.toMatch(
            /score|averageScore|readinessLevel|oneBigUpgrade|feedback_json|summaryNarrative|pass|fail|percentile/i,
        );
    });

    it("adds a stable focused-practice action without putting answer or coaching text in the URL", () => {
        const detail = createCandidateCoachUpdateDetail(createArtifact());

        expect(detail?.items[0]?.focusedPracticeAction).toEqual({
            status: "candidate_focused_practice_action",
            kind: "practice_from_feedback",
            label: "Practice this focus",
            href: "/candidate/practice/ready?intent=coach-update-feedback-focus&fromSession=session-1&questionKey=slot-1",
            source: {
                kind: "coach_update_detail",
                candidatePracticeSessionId: "session-1",
                questionKey: "slot-1",
                questionNumber: 1,
                category: "Behavioral",
                targetRole: "Material Handler I",
            },
        });
        expect(detail?.items[0]?.focusedPracticeAction.href).not.toMatch(/shipment|inventory|result/);
    });

    it("returns null for an absent or noncompleted artifact", () => {
        expect(createCandidateCoachUpdateDetail(null)).toBeNull();
        expect(createCandidateCoachUpdateDetail({
            ...createArtifact(),
            lifecycleState: "requested",
            candidateSafeContent: null,
            validation: null,
            completedAt: null,
        })).toBeNull();
    });
});

function createArtifact(): CandidateCoachUpdateArtifactRecord {
    return {
        candidateCoachUpdateArtifactId: "artifact-1",
        candidateProfileId: "candidate-1",
        roleProfileId: "10000000-0000-4000-8000-000000000001",
        sourceCandidatePracticeSessionId: "session-1",
        sourceCompletionFingerprint: "completion-1",
        sourceAnswerAttemptIds: ["attempt-1"],
        acceptedEvaluationRunIds: ["run-1"],
        synthesisInputFingerprint: "input-1",
        provider: "fixture",
        modelName: "fixture-v1",
        promptVersion: "prompt-v1",
        evaluatorVersion: "evaluator-v1",
        profileId: "fixture-profile-v1",
        configurationFingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        generationAttempt: 1,
        lifecycleState: "completed",
        candidateSafeContent: {
            status: "candidate_coach_update_content_v3",
            targetRole: "Material Handler I",
            title: "Material Handler I practice update",
            summary: "I reviewed your practiced answer.",
            primaryFocus: "Add the result of the inventory count.",
            questions: [{
                questionKey: "slot-1",
                questionNumber: 1,
                category: "Behavioral",
                questionText: "Tell me about a time you handled an inventory issue.",
                answer: {
                    candidateAnswerAttemptId: "attempt-1",
                    mode: "text",
                    text: "I checked the shipment records before updating the inventory sheet.",
                    submittedAt: "2026-07-11T12:01:00.000Z",
                },
                coaching: {
                    acknowledgement: "You chose a relevant work example.",
                    observation: "Your answer includes the task, but the result is still missing.",
                    nextPracticeFocus: "Add the result of the inventory count.",
                },
                comparison: {
                    kind: "first_practice",
                    priorComparableAttemptCount: 0,
                    message: "This is the first accepted practice evidence for this question.",
                },
                source: {
                    candidatePracticeSessionId: "session-1",
                    questionKey: "slot-1",
                },
                transcriptCanvas: null,
            }],
        },
        validation: { disposition: "accepted" },
        errorCode: null,
        requestedAt: "2026-07-11T12:00:01.000Z",
        completedAt: "2026-07-11T12:00:02.000Z",
        createdAt: "2026-07-11T12:00:01.000Z",
        updatedAt: "2026-07-11T12:00:02.000Z",
    };
}
