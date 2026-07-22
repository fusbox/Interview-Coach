import { describe, expect, it } from "vitest";

import {
    CANDIDATE_SETUP_LIMITS,
    candidateSetupStageOptions,
    parseCandidateSetupInput,
    safeParseCandidateSetupInput,
    toCandidateSetupTransition,
} from "./candidate-setup-contract";

describe("candidate setup contract", () => {
    it("trims accepted setup input and keeps stage and count as first-class draft config", () => {
        expect(parseCandidateSetupInput({
            targetRole: "  Customer service representative  ",
            jobDescription: "  Help customers resolve service questions.  ",
            resumeText: "  Supported a high-volume front desk.  ",
            interviewStage: "screening",
            questionCount: "5",
        })).toEqual({
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: "Supported a high-volume front desk.",
            interviewStage: "screening",
            questionCount: 5,
            resumeCaptureMode: "pasted_text",
        });
    });

    it("defaults optional setup values without dropping required stage and count", () => {
        expect(parseCandidateSetupInput({
            targetRole: "QA analyst",
            jobDescription: "Test regulated workflows.",
        })).toEqual({
            targetRole: "QA analyst",
            jobDescription: "Test regulated workflows.",
            resumeText: null,
            interviewStage: "first_interview",
            questionCount: 7,
            resumeCaptureMode: "none",
        });
    });

    it("carries an accepted document artifact as the resume capture mode", () => {
        expect(parseCandidateSetupInput({
            targetRole: "QA analyst",
            jobDescription: "Test regulated workflows.",
            resumeText: "Inspected production records and documented defects.",
            resumeArtifact: {
                artifactId: "20000000-0000-4000-8000-000000000001",
                version: 1,
                revision: 2,
                source: "document_upload",
                candidateLabel: "resume.docx",
                reviewState: "accepted",
            },
        })).toMatchObject({
            resumeCaptureMode: "document_upload",
            resumeArtifact: {
                source: "document_upload",
                candidateLabel: "resume.docx",
                reviewState: "accepted",
            },
        });
    });

    it("rejects missing required role context before a transition can be created", () => {
        const result = safeParseCandidateSetupInput({
            targetRole: " ",
            jobDescription: null,
            questionCount: 7,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.targetRole).toContain("Target role is required.");
            expect(result.error.flatten().fieldErrors.jobDescription).toContain("Job description is required.");
        }
    });

    it("enforces the setup bounds used by the UI", () => {
        expect(safeParseCandidateSetupInput({
            targetRole: "a".repeat(CANDIDATE_SETUP_LIMITS.targetRole + 1),
            jobDescription: "Valid description.",
        }).success).toBe(false);
        expect(safeParseCandidateSetupInput({
            targetRole: "Valid role",
            jobDescription: "a".repeat(CANDIDATE_SETUP_LIMITS.jobDescription + 1),
        }).success).toBe(false);
        expect(safeParseCandidateSetupInput({
            targetRole: "Valid role",
            jobDescription: "Valid description.",
            questionCount: 2,
        }).success).toBe(false);
        expect(safeParseCandidateSetupInput({
            targetRole: "Valid role",
            jobDescription: "Valid description.",
            questionCount: 11,
        }).success).toBe(false);
    });

    it("keeps recommended question counts explicit for each setup stage", () => {
        expect(candidateSetupStageOptions.map((stage) => [stage.id, stage.recommendedCount])).toEqual([
            ["practice_only", 5],
            ["screening", 5],
            ["first_interview", 7],
            ["follow_up", 10],
            ["final_interview", 10],
        ]);
    });

    it("creates a setup transition that records the next route without creating a session", () => {
        const payload = parseCandidateSetupInput({
            targetRole: "Warehouse lead",
            jobDescription: "Coordinate safety workflows.",
            interviewStage: "follow_up",
            questionCount: 7,
        });

        expect(toCandidateSetupTransition(payload)).toEqual({
            status: "ready_for_session_creation",
            nextRoute: "/candidate/session/[sessionId]",
            payload,
        });
    });
});
