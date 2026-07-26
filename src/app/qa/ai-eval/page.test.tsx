import { render, screen } from "@testing-library/react";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type {
    AiEvalRemediation,
    AiEvalRemediationFinding,
    AiEvalWorkItem,
    AiEvalWorkItemDetail,
} from "@/features/ai-eval-v2/ai-eval-workbench-contract";
import { aiEvalScenarioBaselineCases } from "@/features/ai-eval-v2/ai-eval-scenario-baseline";
import type {
    AiEvalScenarioRunDetail,
    AiEvalScenarioVersion,
} from "@/features/ai-eval-v2/ai-eval-scenario-repository";
import { renderAiEvalWorkbenchRoute } from "./AiEvalWorkbenchRoute";

const { redirectMock } = vi.hoisted(() => ({
    redirectMock: vi.fn((target: string) => {
        throw new Error(`redirect:${target}`);
    }),
}));

vi.mock("next/navigation", () => ({
    redirect: redirectMock,
    useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("AI-eval workbench page", () => {
    it("renders the staged scenario library without loading production review content", async () => {
        const loadData = vi.fn();
        const versionFive = scenarioVersion();
        const historicalVersions = [1, 2, 3, 4].map((versionNumber) => ({
            ...versionFive,
            scenarioVersionId: `00000000-0000-4000-8000-${String(versionNumber).padStart(12, "0")}`,
            versionNumber,
        }));
        const customVersion = {
            ...versionFive,
            scenarioVersionId: "00000000-0000-4000-8000-000000000018",
            sourceKind: "operator" as const,
            versionNumber: 1,
        };
        render(await renderAiEvalWorkbenchRoute({ view: "scenarios" }, {
            resolveAccess: async () => authorizedAccess(),
            loadData,
            loadScenarioData: async () => ({
                versions: [...historicalVersions, versionFive, customVersion],
                drafts: [],
                runs: [],
                selectedRun: null,
            }),
        }));

        expect(loadData).not.toHaveBeenCalled();
        expect(screen.getByText(/40 baseline cases|1 baseline case/)).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: aiEvalScenarioBaselineCases[0]!.title })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Run all baseline" })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: "v5" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Clone v5" })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: "Custom" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Clone custom" })).toBeInTheDocument();
        for (const versionNumber of [1, 2, 3, 4]) {
            expect(screen.queryByRole("columnheader", { name: `v${versionNumber}` })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: `Clone v${versionNumber}` })).not.toBeInTheDocument();
        }
    });

    it("uses full-baseline ordinals for scenario order and visible case numbers", async () => {
        const first = scenarioVersion();
        const second = {
            ...scenarioVersion(),
            scenarioVersionId: "00000000-0000-4000-8000-000000000027",
            scenario: aiEvalScenarioBaselineCases[1]!,
            inputFingerprint: "e".repeat(64),
        };
        render(await renderAiEvalWorkbenchRoute({ view: "scenarios" }, {
            resolveAccess: async () => authorizedAccess(),
            loadScenarioData: async () => ({
                versions: [second, first],
                drafts: [],
                runs: [],
                selectedRun: null,
            }),
        }));

        expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
            aiEvalScenarioBaselineCases[0]!.title,
            aiEvalScenarioBaselineCases[1]!.title,
        ]);
        expect(screen.getByText("#1")).toBeInTheDocument();
        expect(screen.getByText("#2")).toBeInTheDocument();
    });

    it("shows a frozen live estimate and explicit acknowledgement before a browser can queue it", async () => {
        const version = scenarioVersion();
        render(await renderAiEvalWorkbenchRoute({ view: "scenarios" }, {
            resolveAccess: async () => authorizedAccess(),
            loadScenarioData: async () => ({
                versions: [version],
                drafts: [],
                runs: [],
                selectedRun: null,
                livePolicy: {
                    enabled: true,
                    ready: true,
                    reasons: [],
                    inputUsdPerMillionTokens: 0.1,
                    outputUsdPerMillionTokens: 0.4,
                    maxEstimatedCostUsd: 5,
                    maxCalls: 10,
                    concurrency: 1,
                    profileId: "live-profile",
                    configurationFingerprint: "a".repeat(64),
                },
                livePreview: {
                    scope: "selected",
                    tag: null,
                    requestedVersionIds: [version.scenarioVersionId],
                    requestedTitles: [version.scenario.title],
                    expandedVersionIds: [version.scenarioVersionId],
                    dependencyTitles: [],
                    preview: {
                        version: "ai_eval_live_cost_preview_v1",
                        selectionFingerprint: "b".repeat(64),
                        requestedCaseCount: 1,
                        expandedCaseCount: 1,
                        dependencyCaseCount: 0,
                        atomicCaseCount: 1,
                        journeyCaseCount: 0,
                        profileId: "live-profile",
                        configurationFingerprint: "a".repeat(64),
                        calls: { minimum: 3, maximum: 6 },
                        tokens: { maximumInput: 10_000, maximumOutput: 4_000 },
                        pricing: {
                            currency: "USD",
                            source: "operator_configured",
                            inputUsdPerMillionTokens: 0.1,
                            outputUsdPerMillionTokens: 0.4,
                        },
                        maximumEstimatedCostUsd: 0.0026,
                        limits: { maxCalls: 10, maxEstimatedCostUsd: 5 },
                        withinLimits: true,
                    },
                },
            }),
        }));

        expect(screen.getByRole("heading", { name: "Live estimate" })).toBeInTheDocument();
        expect(screen.getByText(/Live ready/)).toBeInTheDocument();
        expect(screen.getByRole("checkbox", { name: /reviewed the estimate/i })).toBeRequired();
        expect(screen.getByRole("button", { name: "Queue live run" })).toBeInTheDocument();
    });

    it("drops a bookmarked live preview when it references a hidden historical scenario version", async () => {
        const currentVersion = scenarioVersion();
        const historicalVersion = {
            ...currentVersion,
            scenarioVersionId: "00000000-0000-4000-8000-000000000019",
            versionNumber: 4,
        };
        render(await renderAiEvalWorkbenchRoute({ view: "scenarios" }, {
            resolveAccess: async () => authorizedAccess(),
            loadScenarioData: async () => ({
                versions: [historicalVersion, currentVersion],
                drafts: [],
                runs: [],
                selectedRun: null,
                livePreview: {
                    scope: "selected",
                    tag: null,
                    requestedVersionIds: [historicalVersion.scenarioVersionId],
                    requestedTitles: [historicalVersion.scenario.title],
                    expandedVersionIds: [historicalVersion.scenarioVersionId],
                    dependencyTitles: [],
                    preview: livePreview(),
                },
            }),
        }));

        expect(screen.queryByRole("heading", { name: "Live estimate" })).not.toBeInTheDocument();
        expect(screen.queryByRole("columnheader", { name: "v4" })).not.toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: "v5" })).toBeInTheDocument();
    });

    it("renders every persisted layer from the selected scenario run", async () => {
        const run = scenarioRun();
        render(await renderAiEvalWorkbenchRoute({ view: "runs", run: run.runId }, {
            resolveAccess: async () => authorizedAccess(),
            loadScenarioData: async () => ({
                versions: [scenarioVersion()],
                drafts: [],
                runs: [run],
                selectedRun: run,
            }),
        }));

        expect(screen.getByText(/1 run/)).toBeInTheDocument();
        expect(screen.queryByText("Candidate-visible outputs")).not.toBeInTheDocument();
        expect(screen.getByText("Session Coaching")).toBeInTheDocument();
        expect(screen.getByText(/feedback_interaction_ready/)).toBeInTheDocument();
        expect(screen.getByText("Diagnostics")).toBeInTheDocument();
        const scenario = run.cases[0]!.scenario;
        expect(scenario.kind).toBe("atomic_answer");
        if (scenario.kind === "atomic_answer") {
            expect(screen.getByRole("region", { name: "Case question and answer" })).toHaveTextContent(scenario.question.text);
            expect(screen.getByRole("region", { name: "Case question and answer" })).toHaveTextContent(scenario.answer.text);
        }
    });

    it("renders candidate-visible answer coaching before evidence and configuration", async () => {
        render(await renderAiEvalWorkbenchRoute({ view: "queue", case: WORK_ITEM_ID }, {
            resolveAccess: async () => authorizedAccess(),
            loadData: async () => ({
                workItems: [workItem()],
                eligibleSources: [],
                selectedDetail: detail(),
                review: null,
                findings: [],
                failureLabels: [],
                ...emptyRemediationData(),
            }),
        }));

        expect(screen.getByRole("heading", { name: "Review what the coach delivered." })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "How did you improve the inspection process?" })).toBeInTheDocument();
        expect(screen.getByText("I introduced a checklist and defects fell by 20 percent.")).toBeInTheDocument();
        expect(screen.getByText("That gives the interviewer a concrete action and result.")).toBeInTheDocument();
        expect(screen.getAllByText("Use a clearer sequence and name the result.")).toHaveLength(2);
        expect(screen.getByText("Situation, action, result")).toBeInTheDocument();
        expect(screen.getByText("State the situation briefly.")).toBeInTheDocument();
        expect(screen.getByText("Your delivery was clear and easy to follow.")).toBeInTheDocument();
        expect(screen.getByText(/Retry my answer/)).toBeInTheDocument();
        expect(screen.getByText(/Finish session/)).toBeInTheDocument();
        expect(screen.getByText("Pause session")).toBeInTheDocument();
        expect(screen.getByText("Evidence and configuration")).toBeInTheDocument();
        expect(screen.queryByText(/candidate@example/i)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Start review" })).toBeInTheDocument();
    });

    it("uses the same complete candidate-visible coaching sequence for invited answer sources", async () => {
        render(await renderAiEvalWorkbenchRoute({ view: "queue", case: WORK_ITEM_ID }, {
            resolveAccess: async () => authorizedAccess(),
            loadData: async () => ({
                workItems: [workItem({ sourceKind: "invited_answer_evaluation", audience: "invited" })],
                eligibleSources: [],
                selectedDetail: detail({ sourceKind: "invited_answer_evaluation", audience: "invited" }),
                review: null,
                findings: [],
                failureLabels: [],
                ...emptyRemediationData(),
            }),
        }));

        expect(screen.getByRole("heading", { name: "Invited answer evaluation" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "First, here is what I heard." })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "How it came across" })).toBeInTheDocument();
        expect(screen.getByText("Your delivery was clear and easy to follow.")).toBeInTheDocument();
    });

    it("renders every persisted Coach Update field for each practiced question", async () => {
        const coachItem = workItem({
            surface: "coach_update",
            sourceKind: "candidate_coach_update",
            questionCategory: null,
        });
        render(await renderAiEvalWorkbenchRoute({ view: "queue", case: WORK_ITEM_ID }, {
            resolveAccess: async () => authorizedAccess(),
            loadData: async () => ({
                workItems: [coachItem],
                eligibleSources: [],
                selectedDetail: {
                    ...coachItem,
                    sourcePayload: {
                        coachUpdate: {
                            title: "Your quality-control practice",
                            summary: "You made the result visible and kept the example focused.",
                            primaryFocus: "Connect the inspection step to the decision it changed.",
                            questions: [{
                                questionKey: "q1",
                                questionText: "How did you improve the inspection process?",
                                answer: {
                                    candidateAnswerAttemptId: "00000000-0000-4000-8000-000000000010",
                                    text: COACH_UPDATE_ANSWER,
                                },
                                coaching: {
                                    acknowledgement: "You named a concrete process change.",
                                    observation: "The result makes the impact easy to understand.",
                                    nextPracticeFocus: "Add why the checklist was the right intervention.",
                                },
                                comparison: {
                                    kind: "repeat_practice",
                                    priorComparableAttemptCount: 1,
                                    message: "This time, your result was more specific.",
                                },
                                transcriptCanvas: {
                                    status: "candidate_transcript_canvas_v1",
                                    answerAttemptId: "00000000-0000-4000-8000-000000000010",
                                    evaluationRunId: "00000000-0000-4000-8000-000000000011",
                                    inputFingerprint: "b".repeat(64),
                                    transcriptFingerprint: createHash("sha256").update(COACH_UPDATE_ANSWER).digest("hex"),
                                    annotations: [],
                                    wholeAnswerIndicators: [{
                                        id: "whole-answer-outcome",
                                        basis: { kind: "whole_answer", signalId: "outcome" },
                                        label: "Coach noticed",
                                        message: "The answer includes a measurable result.",
                                    }],
                                    primaryGap: {
                                        id: "gap-rationale",
                                        basis: { kind: "missing_expected_signal", signalId: "rationale" },
                                        label: "Try next",
                                        message: "Explain why the checklist fit the problem.",
                                        suggestedShape: ["Problem", "Choice", "Reason"],
                                    },
                                },
                            }],
                        },
                    },
                },
                review: null,
                findings: [],
                failureLabels: [],
                ...emptyRemediationData(),
            }),
        }));

        expect(screen.getByText("You named a concrete process change.")).toBeInTheDocument();
        expect(screen.getByText("The result makes the impact easy to understand.")).toBeInTheDocument();
        expect(screen.getByText("Add why the checklist was the right intervention.")).toBeInTheDocument();
        expect(screen.getByText("The answer includes a measurable result.")).toBeInTheDocument();
        expect(screen.getByText("Explain why the checklist fit the problem.")).toBeInTheDocument();
        expect(screen.getByText("This time, your result was more specific.")).toBeInTheDocument();
    });

    it.each([
        ["candidate_question_wording", "Candidate question set"],
        ["recruiter_question_wording", "Recruiter question set"],
    ] as const)("renders generated wording for %s", async (sourceKind, expectedHeading) => {
        const questionItem = workItem({
            surface: "question_wording",
            sourceKind,
            audience: sourceKind === "candidate_question_wording" ? "candidate_led" : "recruiter_invite",
            questionCategory: null,
        });
        render(await renderAiEvalWorkbenchRoute({ view: "queue", case: WORK_ITEM_ID }, {
            resolveAccess: async () => authorizedAccess(),
            loadData: async () => ({
                workItems: [questionItem],
                eligibleSources: [],
                selectedDetail: {
                    ...questionItem,
                    sourcePayload: {
                        questionPlan: {
                            slots: [{ id: "q1", category: "behavioral", purpose: "Look for a specific example." }],
                        },
                        questionWording: {
                            questions: [{
                                slotId: "q1",
                                category: "behavioral",
                                questionText: "Tell me about a time you found a quality issue before release.",
                            }],
                        },
                        context: { targetRole: "Quality Control Inspector" },
                    },
                },
                review: null,
                findings: [],
                failureLabels: [],
                ...emptyRemediationData(),
            }),
        }));

        expect(screen.getByRole("heading", { name: expectedHeading })).toBeInTheDocument();
        expect(screen.getByText("Tell me about a time you found a quality issue before release.")).toBeInTheDocument();
        expect(screen.getByText("Look for a specific example.")).toBeInTheDocument();
    });

    it("renders an exact failed-source detail without implying candidate output exists", async () => {
        const failedItem = workItem({
            sourceLifecycleState: "failed",
            sourceFailureCode: "PROVIDER_UNAVAILABLE",
        });
        render(await renderAiEvalWorkbenchRoute({ view: "queue", case: WORK_ITEM_ID }, {
            resolveAccess: async () => authorizedAccess(),
            loadData: async () => ({
                workItems: [failedItem],
                eligibleSources: [],
                selectedDetail: { ...failedItem, sourcePayload: {} },
                review: null,
                findings: [],
                failureLabels: [],
                ...emptyRemediationData(),
            }),
        }));

        expect(screen.getByText("No candidate-visible output was produced.")).toBeInTheDocument();
        expect(screen.getByText(/PROVIDER_UNAVAILABLE/)).toBeInTheDocument();
        expect(screen.queryByText("What the candidate saw")).not.toBeInTheDocument();
    });

    it("shows metadata-only source discovery and an honest failed source", async () => {
        render(await renderAiEvalWorkbenchRoute({ view: "inbox" }, {
            resolveAccess: async () => authorizedAccess(),
            loadData: async () => ({
                workItems: [],
                eligibleSources: [{
                    sourceId: SOURCE_ID,
                    sourceKind: "candidate_answer_evaluation",
                    surface: "answer_coaching",
                    audience: "candidate_led",
                    sourceLifecycleState: "failed",
                    sourceFailureCode: "PROVIDER_UNAVAILABLE",
                    interviewStage: "first_interview",
                    questionCategory: "behavioral",
                    provider: "google_genai",
                    modelName: "gemini-2.5-flash",
                    profileId: "google_gemini_2_5_flash_v1",
                    promptVersion: "prompt-v1",
                    evaluatorVersion: "evaluator-v1",
                    configurationFingerprint: "a".repeat(64),
                    sourceOccurredAt: "2026-07-22T10:00:00.000000Z",
                }],
                selectedDetail: null,
                review: null,
                findings: [],
                failureLabels: [],
                ...emptyRemediationData(),
            }),
        }));

        expect(screen.getByRole("button", { name: /Add to queue/ })).toBeInTheDocument();
        expect(screen.getAllByText("Failed")).toHaveLength(2);
        expect(screen.getByText(/Candidate content is not read until/)).toBeInTheDocument();
    });

    it("fails closed before loading source data when the grant is absent", async () => {
        const loadData = vi.fn();
        render(await renderAiEvalWorkbenchRoute({}, {
            resolveAccess: async () => ({ kind: "forbidden", user: user() }),
            loadData,
        }));

        expect(loadData).not.toHaveBeenCalled();
        expect(screen.getByRole("heading", { name: "This account does not have AI evaluation access." })).toBeInTheDocument();
    });

    it("redirects a missing app session to the exact safe workbench return", async () => {
        await expect(renderAiEvalWorkbenchRoute({}, {
            resolveAccess: async () => ({ kind: "missing" }),
        })).rejects.toThrow("redirect:/login?next=%2Fqa%2Fai-eval");
    });

    it("renders a content-free unavailable state when loading fails", async () => {
        render(await renderAiEvalWorkbenchRoute({}, {
            resolveAccess: async () => authorizedAccess(),
            loadData: async () => { throw new Error("database detail that must not render"); },
        }));

        expect(screen.getByRole("heading", { name: "The workbench is temporarily unavailable." })).toBeInTheDocument();
        expect(screen.queryByText(/database detail/)).not.toBeInTheDocument();
    });

    it("allows an incomplete draft to be saved while submission remains server-validated", async () => {
        render(await renderAiEvalWorkbenchRoute({ view: "queue", case: WORK_ITEM_ID }, {
            resolveAccess: async () => authorizedAccess(),
            loadData: async () => ({
                workItems: [workItem()],
                eligibleSources: [],
                selectedDetail: detail(),
                review: {
                    reviewId: "00000000-0000-4000-8000-000000000003",
                    workItemId: WORK_ITEM_ID,
                    reviewerUserId: "user-1",
                    rubricVersion: "answer_coaching_rubric_v1",
                    lifecycleState: "draft",
                    disposition: null,
                    severity: null,
                    confidence: null,
                    layerJudgments: {},
                    reviewSummary: null,
                    revision: 1,
                    submittedAt: null,
                },
                findings: [],
                failureLabels: [],
                ...emptyRemediationData(),
            }),
        }));

        expect(screen.getByRole("button", { name: /^Save draft$/ })).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "Disposition" })).not.toBeRequired();
        expect(screen.getByRole("combobox", { name: "Answer Usability" })).not.toBeRequired();
    });

    it("renders a target-specific remediation and a later exact-output recheck without copying source content", async () => {
        render(await renderAiEvalWorkbenchRoute({
            view: "remediation",
            remediation: REMEDIATION_ID,
        }, {
            resolveAccess: async () => authorizedAccess(),
            loadData: async () => ({
                workItems: [],
                eligibleSources: [],
                selectedDetail: null,
                review: null,
                findings: [],
                failureLabels: [],
                remediations: [remediation()],
                selectedRemediation: remediation(),
                availableRemediationFindings: [],
                linkedRemediationFindings: [remediationFinding()],
                regressionCases: [{
                    regressionCaseId: REGRESSION_CASE_ID,
                    sourceFindingId: FINDING_ID,
                    originalWorkItemId: WORK_ITEM_ID,
                    surface: "answer_coaching",
                    failureLabel: "evidence_span_false_positive",
                    failureLabelVersion: "ai_eval_failure_labels_v1",
                    layer: "evidence_span",
                    latestOutcome: null,
                    latestVerificationWorkItemId: null,
                    latestRecheckedAt: null,
                    createdAt: "2026-07-22T10:05:00.000000Z",
                }],
                recheckCandidates: [{
                    regressionCaseId: REGRESSION_CASE_ID,
                    reviewId: VERIFICATION_REVIEW_ID,
                    workItemId: VERIFICATION_WORK_ITEM_ID,
                    surface: "answer_coaching",
                    sourceKind: "invited_answer_evaluation",
                    profileId: "google_gemini_2_5_flash_v1",
                    configurationFingerprint: "b".repeat(64),
                    sourceOccurredAt: "2026-07-22T11:00:00.000000Z",
                }],
                rechecks: [],
            }),
        }));

        expect(screen.getByRole("heading", { name: "Reject unsupported span links" })).toBeInTheDocument();
        expect(screen.getByText("Tighter validation should remove unsupported evidence links.")).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "Later reviewed output" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Record recheck" })).toBeInTheDocument();
        expect(screen.queryByText("I introduced a checklist and defects fell by 20 percent.")).not.toBeInTheDocument();
    });
});

const WORK_ITEM_ID = "00000000-0000-4000-8000-000000000001";
const SOURCE_ID = "00000000-0000-4000-8000-000000000002";
const REMEDIATION_ID = "00000000-0000-4000-8000-000000000004";
const FINDING_ID = "00000000-0000-4000-8000-000000000005";
const REGRESSION_CASE_ID = "00000000-0000-4000-8000-000000000006";
const VERIFICATION_REVIEW_ID = "00000000-0000-4000-8000-000000000007";
const VERIFICATION_WORK_ITEM_ID = "00000000-0000-4000-8000-000000000008";
const COACH_UPDATE_ANSWER = "I introduced a checklist and defects fell by 20 percent.";

function workItem(overrides: Partial<AiEvalWorkItem> = {}): AiEvalWorkItem {
    return {
        workItemId: WORK_ITEM_ID,
        surface: "answer_coaching",
        sourceKind: "candidate_answer_evaluation",
        audience: "candidate_led",
        selectionReason: "production_sample",
        lifecycleState: "queued",
        priority: "normal",
        assignedOperatorUserId: null,
        sourceLifecycleState: "completed",
        sourceFailureCode: null,
        interviewStage: "first_interview",
        questionCategory: "behavioral",
        provider: "google_genai",
        modelName: "gemini-2.5-flash",
        profileId: "google_gemini_2_5_flash_v1",
        promptVersion: "prompt-v1",
        evaluatorVersion: "evaluator-v1",
        configurationFingerprint: "a".repeat(64),
        sourceOccurredAt: "2026-07-22T10:00:00.000000Z",
        revision: 1,
        ...overrides,
    };
}

function detail(overrides: Partial<AiEvalWorkItem> = {}): AiEvalWorkItemDetail {
    return {
        ...workItem(overrides),
        sourcePayload: {
            question: { slotId: "q1", index: 0, questionText: "How did you improve the inspection process?" },
            answer: {
                answerAttemptId: "00000000-0000-4000-8000-000000000010",
                slotId: "q1",
                text: "I introduced a checklist and defects fell by 20 percent.",
                attemptNumber: 1,
                trigger: "initial_submit",
                submittedAt: "2026-07-22T09:59:00.000Z",
            },
            evaluation: {
                result: {
                    completedAt: "2026-07-22T10:00:00.000Z",
                    accepted: {
                        candidateProjection: {
                            status: "candidate_safe_feedback",
                            schemaVersion: 1,
                            inputFingerprint: "a".repeat(64),
                            acknowledgement: "That gives the interviewer a concrete action and result.",
                            primaryStrength: "The outcome is specific.",
                            biggestUpgrade: "Use a clearer sequence and name the result.",
                            redoPrompt: "Try it again with the situation, action, and result in order.",
                            patternSuggestion: {
                                patternName: "Situation, action, result",
                                steps: ["State the situation briefly.", "Name your action.", "Close with the result."],
                            },
                            deliveryNote: {
                                status: "light_note",
                                message: "Your delivery was clear and easy to follow.",
                            },
                        },
                        feedback: {
                            status: "feedback_composition_output",
                            schemaVersion: 1,
                            inputFingerprint: "a".repeat(64),
                            feedbackPlan: {
                                centralRead: "The answer has a concrete result but needs a clearer sequence.",
                                signal: { valence: "mixed", detectability: "clear" },
                                primaryAnchor: { kind: "pattern_gap", id: "star-sequence" },
                                intervention: "revise_answer",
                            },
                            candidateFeedback: {
                                acknowledgement: "That gives the interviewer a concrete action and result.",
                                primaryStrength: "The outcome is specific.",
                                biggestUpgrade: "Use a clearer sequence and name the result.",
                                redoPrompt: "Try it again with the situation, action, and result in order.",
                                patternSuggestion: {
                                    patternName: "Situation, action, result",
                                    steps: ["State the situation briefly.", "Name your action.", "Close with the result."],
                                },
                                deliveryNote: {
                                    status: "light_note",
                                    message: "Your delivery was clear and easy to follow.",
                                },
                            },
                            claimEvidence: {
                                acknowledgementSpanIds: ["span-1"],
                                primaryStrengthSpanIds: ["span-2"],
                            },
                        },
                        extraction: {
                            status: "evidence_extraction_output",
                            schemaVersion: 1,
                            inputFingerprint: "a".repeat(64),
                            questionCategory: "behavioral",
                            answerUsability: {
                                status: "usable",
                                reasonCode: "direct_behavioral_example",
                            },
                            observableMarkers: {
                                answeredQuestion: true,
                                hasDirectAnswer: true,
                                hasExample: true,
                                hasSpecificDetails: true,
                                hasPersonalAction: true,
                                hasOutcomeOrTakeaway: true,
                                hasTradeoffOrConstraint: false,
                                hasRoleRelevantSkillSignal: true,
                                isOverlyLong: false,
                                isVeryShort: false,
                            },
                            evidenceSpans: [],
                            categorySignals: [],
                            technicalAccuracy: {
                                status: "not_assessed",
                                referenceConceptIds: [],
                                evidenceSpanIds: [],
                            },
                            missingEvidence: [],
                            sensitiveContentFlags: [],
                            unsafeInferenceFlags: [],
                        },
                        criteria: [{
                            criterionId: "answer_focus",
                            applicability: "observed",
                            band: "clear",
                            evidenceSpanIds: [],
                            reasonCode: "direct_answer",
                        }],
                        patternGap: {
                            id: "strengthen_sequence",
                            severity: "medium",
                            upgrade: "Use a clearer sequence and name the result.",
                            redoPattern: ["situation", "action", "result"],
                            source: "criterion_appraisal",
                        },
                    },
                },
                validation: { disposition: "accepted" },
                configuration: { profileId: "google_gemini_2_5_flash_v1" },
            },
            context: { questionPlan: { questionCount: 1, slots: [{ id: "q1" }] } },
        },
    };
}

function remediation(): AiEvalRemediation {
    return {
        remediationId: REMEDIATION_ID,
        ownerOperatorUserId: "user-1",
        lifecycleState: "ready_for_recheck",
        targetComponent: "exact_span_validation",
        title: "Reject unsupported span links",
        hypothesis: "Tighter validation should remove unsupported evidence links.",
        expectedChange: "Unsupported links fail closed before coaching composition.",
        regressionRisks: "Strict validation could reject weak but useful evidence.",
        changeKind: "code",
        changedReference: "commit:abc123",
        verificationNote: null,
        revision: 4,
        findingCount: 1,
        regressionCaseCount: 1,
        recheckCount: 0,
        createdAt: "2026-07-22T10:05:00.000000Z",
        updatedAt: "2026-07-22T10:30:00.000000Z",
    };
}

function remediationFinding(): AiEvalRemediationFinding {
    return {
        findingId: FINDING_ID,
        reviewId: "00000000-0000-4000-8000-000000000009",
        workItemId: WORK_ITEM_ID,
        surface: "answer_coaching",
        sourceKind: "candidate_answer_evaluation",
        sourceOccurredAt: "2026-07-22T10:00:00.000000Z",
        layer: "evidence_span",
        failureLabel: "evidence_span_false_positive",
        failureLabelVersion: "ai_eval_failure_labels_v1",
        severity: "major",
        sourceReference: { spanId: "span-2" },
        rationale: "The cited span does not support the coaching claim.",
        createdAt: "2026-07-22T10:05:00.000000Z",
        regressionCaseId: REGRESSION_CASE_ID,
    };
}

function scenarioVersion(): AiEvalScenarioVersion {
    return {
        scenarioVersionId: "00000000-0000-4000-8000-000000000020",
        sourceDraftId: null,
        sourceKind: "baseline",
        scenario: aiEvalScenarioBaselineCases[0]!,
        versionNumber: 5,
        inputFingerprint: "c".repeat(64),
        stagedAt: "2026-07-22T12:00:00.000Z",
    };
}

function livePreview() {
    return {
        version: "ai_eval_live_cost_preview_v1",
        selectionFingerprint: "b".repeat(64),
        requestedCaseCount: 1,
        expandedCaseCount: 1,
        dependencyCaseCount: 0,
        atomicCaseCount: 1,
        journeyCaseCount: 0,
        profileId: "live-profile",
        configurationFingerprint: "a".repeat(64),
        calls: { minimum: 3, maximum: 6 },
        tokens: { maximumInput: 10_000, maximumOutput: 4_000 },
        pricing: {
            currency: "USD",
            source: "operator_configured",
            inputUsdPerMillionTokens: 0.1,
            outputUsdPerMillionTokens: 0.4,
        },
        maximumEstimatedCostUsd: 0.0026,
        limits: { maxCalls: 10, maxEstimatedCostUsd: 5 },
        withinLimits: true,
    } as const;
}

function scenarioRun(): AiEvalScenarioRunDetail {
    return {
        runId: "00000000-0000-4000-8000-000000000021",
        executionMode: "contract_fixture",
        lifecycleState: "completed",
        profileId: "deterministic_local_fixture_v1",
        configurationFingerprint: "d".repeat(64),
        caseCount: 1,
        completedCaseCount: 1,
        failedCaseCount: 0,
        assertionResult: "review_required",
        requestedAt: "2026-07-22T12:00:00.000Z",
        completedAt: "2026-07-22T12:00:01.000Z",
        retentionExpiresAt: "2026-08-21T12:00:00.000Z",
        costPreview: null,
        cases: [{
            runCaseId: "00000000-0000-4000-8000-000000000022",
            scenarioVersionId: scenarioVersion().scenarioVersionId,
            scenario: scenarioVersion().scenario,
            inputFingerprint: scenarioVersion().inputFingerprint,
            ordinal: 1,
            lifecycleState: "completed",
            assertionResult: "review_required",
            assertionReasons: ["Operator review is required."],
            errorCode: null,
            layers: [{
                runLayerId: "00000000-0000-4000-8000-000000000024",
                outputLayer: "evaluator_diagnostics",
                lifecycleState: "completed",
                assertionResult: "pass",
                assertionReasons: [],
                candidateVisible: false,
                output: { rawProviderOutputStored: false },
                diagnostics: { configurationFingerprint: "d".repeat(64) },
                errorCode: null,
            }, {
                runLayerId: "00000000-0000-4000-8000-000000000023",
                outputLayer: "session_coaching",
                lifecycleState: "completed",
                assertionResult: "review_required",
                assertionReasons: ["Review teaching quality."],
                candidateVisible: true,
                output: { status: "feedback_interaction_ready", acknowledgement: "You gave a concrete example." },
                diagnostics: null,
                errorCode: null,
            }],
        }],
    };
}

function authorizedAccess() {
    return {
        kind: "authorized" as const,
        user: user(),
        grant: { grantId: "grant-1", userId: "user-1", grantedAt: "2026-07-22T00:00:00.000Z" },
    };
}

function emptyRemediationData() {
    return {
        remediations: [],
        selectedRemediation: null,
        availableRemediationFindings: [],
        linkedRemediationFindings: [],
        regressionCases: [],
        recheckCandidates: [],
        rechecks: [],
    };
}

function user() {
    return {
        id: "user-1",
        email: "operator@example.invalid",
        displayName: "QA Operator",
        status: "active" as const,
        roles: ["qa" as const],
    };
}
