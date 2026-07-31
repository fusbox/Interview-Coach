import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
    createCandidateQuestionContentFingerprint,
    createCandidateQuestionResumeAnchors,
    hydrateCandidateQuestionAssistance,
    parseCandidateQuestionAssistance,
} from "./candidate-question-assistance";

const acceptedResumeArtifact = {
    artifactId: "resume-artifact-1",
    version: 1,
    revision: 1,
    source: "pasted_text" as const,
    candidateLabel: "Pasted resume",
    reviewState: "accepted" as const,
};

describe("candidate question assistance", () => {
    it("derives bounded exact anchors only from an accepted processed resume snapshot", () => {
        const resumeText = [
            "Checked outbound orders and documented labeling errors.",
            "Worked with team leads to correct shipment issues before dispatch.",
            "Checked outbound orders and documented labeling errors.",
        ].join("\n");

        const anchors = createCandidateQuestionResumeAnchors({
            resumeText,
            resumeArtifact: acceptedResumeArtifact,
        });

        expect(anchors).toHaveLength(2);
        expect(anchors[0]).toEqual({
            id: expect.stringMatching(/^resume_anchor_[a-f0-9]{16}$/),
            text: "Checked outbound orders and documented labeling errors.",
        });
        expect(anchors.every((anchor) => resumeText.includes(anchor.text))).toBe(true);
        expect(createCandidateQuestionResumeAnchors({
            resumeText,
            resumeArtifact: { ...acceptedResumeArtifact, reviewState: "awaiting_review" },
        })).toEqual([]);
        expect(createCandidateQuestionResumeAnchors({
            resumeText,
            resumeArtifact: null,
        })).toEqual([]);
    });

    it("hydrates only code-owned hints, a category structure, placeholders, and an exact resume cue", () => {
        const resumeAnchors = createCandidateQuestionResumeAnchors({
            resumeText: "Checked outbound orders and documented labeling errors.",
            resumeArtifact: acceptedResumeArtifact,
        });
        const hydrated = hydrateCandidateQuestionAssistance({
            category: "behavioral",
            questionText: "Tell me about a time you caught an inventory error.",
            assistancePlan: {
                evidenceFocus: ["brief_context", "personal_action", "observable_result"],
                resumeAnchorId: resumeAnchors[0].id,
            },
            resumeAnchors,
        });

        expect(hydrated).toMatchObject({
            assistance: {
                status: "candidate_question_assistance_v1",
                evidenceFocus: ["brief_context", "personal_action", "observable_result"],
                hints: [
                    "Give only enough context to make the example easy to follow.",
                    "Make your own actions and decisions clear.",
                    "Include a result, change, or lesson the interviewer can understand.",
                ],
                responseStructure: [
                    "Set the situation briefly.",
                    "Describe the action you personally took.",
                    "Close with the result or what you learned.",
                ],
                exampleFramework: expect.stringContaining("[personal action]"),
                acceptedResumeAnchor: {
                    id: resumeAnchors[0].id,
                    text: resumeAnchors[0].text,
                    cue: `Use this accepted resume detail if it helps: ${resumeAnchors[0].text}`,
                },
            },
            contentFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        });
        expect(hydrated.assistance.exampleFramework).not.toContain("Checked outbound");
    });

    it("rejects duplicate, category-incompatible, and unknown-anchor provider selections", () => {
        expect(() => hydrateCandidateQuestionAssistance({
            category: "screening",
            questionText: "What interests you about this role?",
            assistancePlan: {
                evidenceFocus: ["answer_first", "answer_first"],
                resumeAnchorId: null,
            },
            resumeAnchors: [],
        })).toThrow("Invalid candidate question assistance.");
        expect(() => hydrateCandidateQuestionAssistance({
            category: "screening",
            questionText: "What interests you about this role?",
            assistancePlan: {
                evidenceFocus: ["answer_first", "verification_or_escalation"],
                resumeAnchorId: null,
            },
            resumeAnchors: [],
        })).toThrow("Invalid candidate question assistance.");
        expect(() => hydrateCandidateQuestionAssistance({
            category: "screening",
            questionText: "What interests you about this role?",
            assistancePlan: {
                evidenceFocus: ["answer_first", "role_connection"],
                resumeAnchorId: "resume_anchor_0000000000000000",
            },
            resumeAnchors: [],
        })).toThrow("Invalid candidate question assistance.");
    });

    it("uses a portable SHA-256 content fingerprint and removes tampered stored assistance", () => {
        const questionText = "How would you verify that your work is complete?";
        const hydrated = hydrateCandidateQuestionAssistance({
            category: "technical_role_specific",
            questionText,
            assistancePlan: {
                evidenceFocus: ["practical_application", "reasoning", "verification_or_escalation"],
                resumeAnchorId: null,
            },
            resumeAnchors: [],
        });
        const expectedFingerprint = createHash("sha256").update(JSON.stringify({
            category: "technical_role_specific",
            questionText,
            assistance: hydrated.assistance,
        })).digest("hex");

        expect(createCandidateQuestionContentFingerprint({
            category: "technical_role_specific",
            questionText,
            assistance: hydrated.assistance,
        })).toBe(expectedFingerprint);
        expect(parseCandidateQuestionAssistance({
            value: hydrated.assistance,
            category: "technical_role_specific",
            questionText,
            contentFingerprint: hydrated.contentFingerprint,
        })).toEqual(hydrated);
        expect(parseCandidateQuestionAssistance({
            value: {
                ...hydrated.assistance,
                hints: ["Use an exact regulation.", ...hydrated.assistance.hints.slice(1)],
            },
            category: "technical_role_specific",
            questionText,
            contentFingerprint: hydrated.contentFingerprint,
        })).toBeNull();
        expect(parseCandidateQuestionAssistance({
            value: hydrated.assistance,
            category: "technical_role_specific",
            questionText: `${questionText} Changed.`,
            contentFingerprint: hydrated.contentFingerprint,
        })).toBeNull();
    });
});
