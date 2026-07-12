import { describe, expect, it } from "vitest";

import type { CandidatePostRoundReview } from "@/features/candidate-session-v2/candidate-completed-round-read-model";

import { createCandidateCoachUpdateDetail } from "./candidate-coach-update-detail";

describe("candidate Coach Update detail contract", () => {
    it("derives a question-first opened Coach Update detail from a post-round review", () => {
        const detail = createCandidateCoachUpdateDetail(createPostRoundReview());

        expect(detail).toEqual({
            status: "candidate_coach_update_detail_ready",
            candidatePracticeSessionId: "session-1",
            targetRole: "Material Handler I",
            completedAt: "2026-07-11T12:00:00.000Z",
            answeredCount: 1,
            questionCount: 2,
            reviewPosture: "partially_reviewable",
            items: [
                {
                    status: "candidate_coach_update_question_detail",
                    questionKey: "slot-1",
                    questionNumber: 1,
                    category: "Behavioral",
                    questionText: "Tell me about a time you handled an inventory issue.",
                    evidenceStatus: "practiced",
                    answer: {
                        mode: "text",
                        text: "I noticed the count was off and checked the shipment records before updating the inventory sheet.",
                        submittedAt: "2026-07-11T12:01:00.000Z",
                    },
                    coachRead: {
                        acknowledgement: "You chose a relevant work example.",
                        observation: "Your answer includes the task, but the result is still missing.",
                        nextPracticeFocus: "Add the result of the inventory count.",
                        overallBand: "clear",
                    },
                    actionPosture: {
                        kind: "review_coaching",
                        label: "Review coach feedback",
                        reason: "This answer has coaching ready.",
                    },
                    focusedPracticeAction: {
                        status: "candidate_focused_practice_action",
                        kind: "practice_from_feedback",
                        label: "Practice this focus",
                        href: "/candidate/setup?intent=coach-update-feedback-focus&fromSession=session-1&questionKey=slot-1",
                        source: {
                            kind: "coach_update_detail",
                            candidatePracticeSessionId: "session-1",
                            questionKey: "slot-1",
                            questionNumber: 1,
                            category: "Behavioral",
                            targetRole: "Material Handler I",
                        },
                    },
                },
                {
                    status: "candidate_coach_update_question_detail",
                    questionKey: "slot-2",
                    questionNumber: 2,
                    category: "Scenario",
                    questionText: "How would you respond if a pallet label did not match the manifest?",
                    evidenceStatus: "missing_practice_evidence",
                    actionPosture: {
                        kind: "practice_missing_evidence",
                        label: "Practice this question",
                        reason: "This planned question has not been answered yet.",
                    },
                    focusedPracticeAction: {
                        status: "candidate_focused_practice_action",
                        kind: "practice_missing_evidence",
                        label: "Practice this question",
                        href: "/candidate/setup?intent=coach-update-missing-evidence&fromSession=session-1&questionKey=slot-2",
                        source: {
                            kind: "coach_update_detail",
                            candidatePracticeSessionId: "session-1",
                            questionKey: "slot-2",
                            questionNumber: 2,
                            category: "Scenario",
                            targetRole: "Material Handler I",
                        },
                    },
                },
            ],
        });
    });

    it("does not expose raw scores, legacy fields, or durable dashboard conclusions", () => {
        const detail = createCandidateCoachUpdateDetail(createPostRoundReview());

        expect(JSON.stringify(detail)).not.toMatch(
            /score|averageScore|readinessLevel|oneBigUpgrade|feedback_json|summaryNarrative|pass|fail|percentile/i,
        );
    });

    it("adds stable focused-practice actions without putting answer or coaching text in the URL", () => {
        const detail = createCandidateCoachUpdateDetail(createPostRoundReview());

        expect(detail?.items[0]?.focusedPracticeAction).toEqual({
            status: "candidate_focused_practice_action",
            kind: "practice_from_feedback",
            label: "Practice this focus",
            href: "/candidate/setup?intent=coach-update-feedback-focus&fromSession=session-1&questionKey=slot-1",
            source: {
                kind: "coach_update_detail",
                candidatePracticeSessionId: "session-1",
                questionKey: "slot-1",
                questionNumber: 1,
                category: "Behavioral",
                targetRole: "Material Handler I",
            },
        });
        expect(detail?.items[1]?.focusedPracticeAction).toEqual({
            status: "candidate_focused_practice_action",
            kind: "practice_missing_evidence",
            label: "Practice this question",
            href: "/candidate/setup?intent=coach-update-missing-evidence&fromSession=session-1&questionKey=slot-2",
            source: {
                kind: "coach_update_detail",
                candidatePracticeSessionId: "session-1",
                questionKey: "slot-2",
                questionNumber: 2,
                category: "Scenario",
                targetRole: "Material Handler I",
            },
        });
        expect(detail?.items[0]?.focusedPracticeAction?.href).not.toContain("shipment");
        expect(detail?.items[0]?.focusedPracticeAction?.href).not.toContain("inventory");
        expect(detail?.items[0]?.focusedPracticeAction?.href).not.toContain("result");
    });

    it("returns null when there is no post-round review to open", () => {
        expect(createCandidateCoachUpdateDetail(null)).toBeNull();
    });
});

function createPostRoundReview(): CandidatePostRoundReview {
    return {
        status: "candidate_post_round_review_ready",
        candidatePracticeSessionId: "session-1",
        targetRole: "Material Handler I",
        completedAt: "2026-07-11T12:00:00.000Z",
        answeredCount: 1,
        questionCount: 2,
        questions: [
            {
                questionKey: "slot-1",
                questionNumber: 1,
                category: "Behavioral",
                questionText: "Tell me about a time you handled an inventory issue.",
                status: "practiced",
                answer: {
                    mode: "text",
                    text: "I noticed the count was off and checked the shipment records before updating the inventory sheet.",
                    submittedAt: "2026-07-11T12:01:00.000Z",
                },
                coaching: {
                    acknowledgement: "You chose a relevant work example.",
                    observation: "Your answer includes the task, but the result is still missing.",
                    nextPracticeFocus: "Add the result of the inventory count.",
                    overallBand: "clear",
                },
            },
            {
                questionKey: "slot-2",
                questionNumber: 2,
                category: "Scenario",
                questionText: "How would you respond if a pallet label did not match the manifest?",
                status: "skipped_or_unanswered",
            },
        ],
    };
}
