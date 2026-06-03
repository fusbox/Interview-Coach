import type { AnalysisResult, Answer, Question } from "@/lib/domain/types";
import { getQuestionCategoryPresentation } from "@/features/session/components/question-category-presentation";
import type { Dimension } from "@/lib/constants";

export type PrepEvidenceState = "not_practiced" | "emerging" | "clear" | "strong";

export type PrepSignalLane =
    | "role_fit"
    | "answer_substance"
    | "interview_structure"
    | "communication_delivery"
    | "interview_range";

export type PrepEvidenceRefType =
    | "job_description"
    | "resume_context"
    | "question"
    | "answer"
    | "feedback_plan"
    | "content_pulse"
    | "delivery_pulse"
    | "coach_signal"
    | "summary";

export type PrepEvidenceRef = {
    type: PrepEvidenceRefType;
    id?: string;
    label: string;
    excerpt?: string;
};

export type PrepSignal = {
    signalId: string;
    prepProfileId: string;
    label: string;
    lane: PrepSignalLane;
    evidenceState: PrepEvidenceState;
    evidenceCounts: Record<PrepEvidenceState, number>;
    averageScore?: number;
    fillPercent?: number;
    priority: "primary" | "supporting" | "background";
    sourceRefs: PrepEvidenceRef[];
};

export type PrepQuestionCategoryCard = {
    categoryId: "behavioral" | "culture_fit" | "technical_role_specific" | "case_scenario" | "screening";
    label: string;
    questionCount: number;
    evidenceState: PrepEvidenceState;
    averageScore?: number;
    sourceRefs: PrepEvidenceRef[];
};

export type PrepObservation = {
    observationId: string;
    prepProfileId: string;
    sessionId: string;
    questionId: string;
    answerId: string;
    signalId?: string;
    source: "feedback_plan" | "content_pulse" | "delivery_pulse";
    state: "thin" | "growth" | "mixed" | "strength";
    summary: string;
};

export type PrepRecommendation = {
    prepProfileId: string;
    source: "unfinished_session" | "answer_feedback" | "session_summary" | "confidence" | "first_practice";
    label: string;
    reason: string;
    href: string;
    sourceRefs: PrepEvidenceRef[];
};

export type PrepProfileReadModelInput = {
    prepProfileId: string;
    targetRole: string;
    jobDescription?: string | null;
    resumeContextState?: "none" | "present" | "processed";
    sessionId?: string;
    questions?: Question[];
    answers?: Answer[];
    summaryNarrative?: string | null;
    activeSessionHref?: string | null;
};

export type PrepProfileReadModel = {
    prepProfileId: string;
    signals: PrepSignal[];
    categoryCards: PrepQuestionCategoryCard[];
    observations: PrepObservation[];
    recommendation: PrepRecommendation;
};

type SignalDraft = Omit<PrepSignal, "sourceRefs"> & {
    sourceRefs: PrepEvidenceRef[];
    evidenceEvents: SignalEvidenceEvent[];
};

type SignalEvidenceEvent = {
    state: PrepEvidenceState;
    observedAt?: number;
};

const CONTENT_PULSE_LABELS: Record<string, string> = {
    focus_relevance: "Answer the question being asked",
    structural_clarity: "Make the answer easy to follow",
    specificity_concreteness: "Use concrete examples",
    outcome_explicitness: "Show what changed",
    decision_rationale: "Explain why you chose that action",
};

const DELIVERY_PULSE_LABELS: Record<string, string> = {
    filler_words: "Keep delivery clean",
    signposting: "Guide the interviewer through the answer",
    conciseness: "Keep the answer tight",
    resilience: "Stay composed when the answer is hard",
};

const STATE_RANK: Record<PrepEvidenceState, number> = {
    not_practiced: 0,
    emerging: 1,
    clear: 2,
    strong: 3,
};

const EMPTY_EVIDENCE_COUNTS: Record<PrepEvidenceState, number> = {
    not_practiced: 0,
    emerging: 0,
    clear: 0,
    strong: 0,
};

const RELEASE_LANE_DIMENSIONS: Array<{
    id: Extract<PrepSignalLane, "answer_substance" | "interview_structure" | "communication_delivery">;
    label: string;
    dimensions: Dimension[];
}> = [
    {
        id: "answer_substance",
        label: "Answer Substance",
        dimensions: ["focus_relevance", "specificity_concreteness", "outcome_explicitness", "decision_rationale"],
    },
    {
        id: "interview_structure",
        label: "Interview Structure",
        dimensions: ["structural_clarity", "signposting"],
    },
    {
        id: "communication_delivery",
        label: "Communication Delivery",
        dimensions: ["filler_words", "conciseness", "resilience"],
    },
];

export function buildPrepProfileReadModel(input: PrepProfileReadModelInput): PrepProfileReadModel {
    const questions = input.questions ?? [];
    const answers = input.answers ?? [];
    if (answers.some((answer) => answer.analysis?.scores)) {
        return buildScoreDrivenReadModel(input, questions, answers);
    }

    const answerByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));
    const signals = new Map<string, SignalDraft>();
    const observations: PrepObservation[] = [];

    addOrMergeSignal(signals, buildInterviewContextSignal(input));

    for (const question of questions) {
        const answer = answerByQuestionId.get(question.id);
        const categorySignal = buildCategorySignal(input, question, answer);
        addOrMergeSignal(signals, categorySignal);

        if (!answer?.analysis) {
            continue;
        }

        const feedbackObservation = buildFeedbackObservation(input, question, answer);
        if (feedbackObservation) {
            observations.push(feedbackObservation);
        }

        const feedbackPlanSignal = buildFeedbackPlanSignal(input, question, answer);
        if (feedbackPlanSignal) {
            addOrMergeSignal(signals, feedbackPlanSignal);
        }

        for (const pulseSignal of buildPulseSignals(input, question, answer)) {
            addOrMergeSignal(signals, pulseSignal);
        }
    }

    const finalizedSignals = Array.from(signals.values())
        .map(finalizeSignal)
        .sort(sortSignals);

    return {
        prepProfileId: input.prepProfileId,
        signals: finalizedSignals,
        categoryCards: [],
        observations,
        recommendation: buildPrepRecommendation(input, finalizedSignals),
    };
}

function buildScoreDrivenReadModel(
    input: PrepProfileReadModelInput,
    questions: Question[],
    answers: Answer[],
): PrepProfileReadModel {
    const answerByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));
    const scoredAnswers = answers.filter((answer) => answer.analysis?.scores);
    const signals = RELEASE_LANE_DIMENSIONS.map((lane) => buildScoreDrivenLaneSignal(input, lane, scoredAnswers));
    const categoryCards = buildScoreDrivenCategoryCards(input, questions, answerByQuestionId);
    const observations = questions
        .map((question) => {
            const answer = answerByQuestionId.get(question.id);
            return answer?.analysis ? buildFeedbackObservation(input, question, answer) : null;
        })
        .filter((observation): observation is PrepObservation => Boolean(observation));

    return {
        prepProfileId: input.prepProfileId,
        signals,
        categoryCards,
        observations,
        recommendation: buildPrepRecommendation(input, signals),
    };
}

function buildScoreDrivenLaneSignal(
    input: PrepProfileReadModelInput,
    lane: (typeof RELEASE_LANE_DIMENSIONS)[number],
    answers: Answer[],
): PrepSignal {
    const scores = answers.flatMap((answer) => collectScores(answer.analysis, lane.dimensions));
    const averageScore = average(scores);
    const evidenceState = scoreToEvidenceState(averageScore);

    return {
        signalId: `lane:${lane.id}`,
        prepProfileId: input.prepProfileId,
        label: lane.label,
        lane: lane.id,
        evidenceState,
        evidenceCounts: evidenceCountFor(evidenceState),
        averageScore: averageScore === null ? undefined : roundScore(averageScore),
        fillPercent: scoreToFillPercent(averageScore),
        priority: evidenceState === "emerging" ? "primary" : "supporting",
        sourceRefs: buildScoreLaneRefs(answers, lane.dimensions),
    };
}

function buildScoreDrivenCategoryCards(
    input: PrepProfileReadModelInput,
    questions: Question[],
    answerByQuestionId: Map<string, Answer>,
): PrepQuestionCategoryCard[] {
    const grouped = new Map<PrepQuestionCategoryCard["categoryId"], {
        label: string;
        questions: Question[];
        answers: Answer[];
    }>();

    for (const question of questions) {
        const category = normalizeQuestionCategory(question.category);
        if (!category) {
            continue;
        }
        const current = grouped.get(category.categoryId) ?? {
            label: category.label,
            questions: [],
            answers: [],
        };
        current.questions.push(question);
        const answer = answerByQuestionId.get(question.id);
        if (answer?.analysis?.scores) {
            current.answers.push(answer);
        }
        grouped.set(category.categoryId, current);
    }

    return Array.from(grouped.entries()).map(([categoryId, group]) => {
        const scores = group.answers.flatMap((answer) => collectScores(answer.analysis, [
            "focus_relevance",
            "specificity_concreteness",
            "outcome_explicitness",
            "decision_rationale",
            "structural_clarity",
            "signposting",
            "filler_words",
            "conciseness",
            "resilience",
        ]));
        const averageScore = average(scores);
        return {
            categoryId,
            label: group.label,
            questionCount: group.questions.length,
            evidenceState: scoreToEvidenceState(averageScore),
            averageScore: averageScore === null ? undefined : roundScore(averageScore),
            sourceRefs: group.questions.flatMap((question) => {
                const answer = answerByQuestionId.get(question.id);
                return [
                    { type: "question" as const, id: question.id, label: group.label, excerpt: excerpt(question.text) },
                    ...buildAnalysisEvidenceRefs(question.id, answer?.analysis),
                    ...buildResumeContextRefs(input),
                ];
            }),
        };
    });
}

function buildInterviewContextSignal(input: PrepProfileReadModelInput): SignalDraft {
    return {
        signalId: "interview_context",
        prepProfileId: input.prepProfileId,
        label: `Prepare for ${input.targetRole}`,
        lane: "role_fit",
        evidenceState: input.jobDescription?.trim() ? "clear" : "not_practiced",
        evidenceCounts: evidenceCountFor(input.jobDescription?.trim() ? "clear" : "not_practiced"),
        evidenceEvents: evidenceEventsFor(input.jobDescription?.trim() ? "clear" : "not_practiced"),
        priority: "background",
        sourceRefs: input.jobDescription?.trim()
            ? [{ type: "job_description", label: "Job description saved", excerpt: excerpt(input.jobDescription) }]
            : [],
    };
}

function buildCategorySignal(
    input: PrepProfileReadModelInput,
    question: Question,
    answer: Answer | undefined,
): SignalDraft {
    const category = getQuestionCategoryPresentation(question.category);
    const analysis = answer?.analysis;
    return {
        signalId: `category:${category.label.toLowerCase().replace(/\s+/g, "_")}`,
        prepProfileId: input.prepProfileId,
        label: `Practice ${category.label} questions`,
        lane: "interview_range",
        evidenceState: deriveEvidenceState(analysis),
        evidenceCounts: evidenceCountFor(deriveEvidenceState(analysis)),
        evidenceEvents: evidenceEventsFor(deriveEvidenceState(analysis), answer?.submittedAt),
        priority: "supporting",
        sourceRefs: [
            { type: "question", id: question.id, label: category.label, excerpt: excerpt(question.text) },
            ...buildResumeContextRefs(input),
            ...buildAnalysisEvidenceRefs(question.id, analysis),
        ],
    };
}

function buildFeedbackObservation(
    input: PrepProfileReadModelInput,
    question: Question,
    answer: Answer,
): PrepObservation | null {
    const analysis = answer.analysis;
    const feedbackPlan = analysis?.feedbackPlan;
    if (!analysis || !feedbackPlan || !input.sessionId) {
        return null;
    }

    return {
        observationId: `${input.sessionId}:${question.id}:feedback_plan`,
        prepProfileId: input.prepProfileId,
        sessionId: input.sessionId,
        questionId: question.id,
        answerId: `${input.sessionId}:${question.id}`,
        source: "feedback_plan",
        state: mapFeedbackPlanToObservationState(analysis),
        summary: feedbackPlan.centralRead,
    };
}

function buildFeedbackPlanSignal(
    input: PrepProfileReadModelInput,
    question: Question,
    answer: Answer,
): SignalDraft | null {
    const analysis = answer.analysis;
    const feedbackPlan = analysis?.feedbackPlan;
    const anchor = feedbackPlan?.primaryAnchor;
    if (!analysis || !feedbackPlan || !anchor) {
        return null;
    }

    const signalId = feedbackPlanSignalId(anchor.source, anchor.dimension);
    if (
        (analysis.contentPulse && signalId === `content:${analysis.contentPulse.dimension}`) ||
        (analysis.deliveryPulse && signalId === `delivery:${analysis.deliveryPulse.dimension}`)
    ) {
        return null;
    }

    return {
        signalId,
        prepProfileId: input.prepProfileId,
        label: signalLabelFor(anchor.source, anchor.dimension),
        lane: laneForFeedbackAnchor(anchor.source, anchor.dimension),
        evidenceState: deriveEvidenceState(analysis),
        evidenceCounts: evidenceCountFor(deriveEvidenceState(analysis)),
        evidenceEvents: evidenceEventsFor(deriveEvidenceState(analysis), answer.submittedAt),
        priority: "primary",
        sourceRefs: [
            {
                type: "feedback_plan",
                id: question.id,
                label: titleCaseDimension(anchor.dimension),
                excerpt: excerpt(anchor.candidateEvidence || feedbackPlan.centralRead),
            },
            ...buildResumeContextRefs(input),
        ],
    };
}

function buildPulseSignals(input: PrepProfileReadModelInput, question: Question, answer: Answer): SignalDraft[] {
    const signals: SignalDraft[] = [];
    const contentPulse = answer.analysis?.contentPulse;
    const deliveryPulse = answer.analysis?.deliveryPulse;

    if (contentPulse) {
        signals.push({
            signalId: `content:${contentPulse.dimension}`,
            prepProfileId: input.prepProfileId,
            label: CONTENT_PULSE_LABELS[contentPulse.dimension] ?? contentPulse.headline,
            lane: contentPulse.dimension === "structural_clarity" ? "interview_structure" : "answer_substance",
            evidenceState: deriveEvidenceState(answer.analysis),
            evidenceCounts: evidenceCountFor(deriveEvidenceState(answer.analysis)),
            evidenceEvents: evidenceEventsFor(deriveEvidenceState(answer.analysis), answer.submittedAt),
            priority: "primary",
            sourceRefs: [
                { type: "content_pulse", id: question.id, label: contentPulse.headline, excerpt: excerpt(contentPulse.body) },
                ...buildResumeContextRefs(input),
                ...buildAnalysisEvidenceRefs(question.id, answer.analysis),
            ],
        });
    }

    if (deliveryPulse) {
        signals.push({
            signalId: `delivery:${deliveryPulse.dimension}`,
            prepProfileId: input.prepProfileId,
            label: DELIVERY_PULSE_LABELS[deliveryPulse.dimension] ?? deliveryPulse.headline,
            lane: "communication_delivery",
            evidenceState: deriveEvidenceState(answer.analysis),
            evidenceCounts: evidenceCountFor(deriveEvidenceState(answer.analysis)),
            evidenceEvents: evidenceEventsFor(deriveEvidenceState(answer.analysis), answer.submittedAt),
            priority: "supporting",
            sourceRefs: [
                { type: "delivery_pulse", id: question.id, label: deliveryPulse.headline, excerpt: excerpt(deliveryPulse.body) },
                ...buildAnalysisEvidenceRefs(question.id, answer.analysis),
            ],
        });
    }

    return signals;
}

function feedbackPlanSignalId(source: "content" | "delivery" | "fallback", dimension: Dimension): string {
    if (source === "delivery") {
        return `delivery:${dimension}`;
    }
    return `content:${dimension}`;
}

function signalLabelFor(source: "content" | "delivery" | "fallback", dimension: Dimension): string {
    if (source === "delivery") {
        return DELIVERY_PULSE_LABELS[dimension] ?? titleCaseDimension(dimension);
    }
    return CONTENT_PULSE_LABELS[dimension] ?? titleCaseDimension(dimension);
}

function laneForFeedbackAnchor(source: "content" | "delivery" | "fallback", dimension: Dimension): PrepSignalLane {
    if (source === "delivery") {
        return "communication_delivery";
    }
    if (dimension === "structural_clarity") {
        return "interview_structure";
    }
    return "answer_substance";
}

function titleCaseDimension(dimension: Dimension): string {
    const words = dimension
        .split("_")
        .map((part) => part.toLowerCase());
    return words
        .map((part, index) => index === 0 ? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}` : part)
        .join(" ");
}

function buildResumeContextRefs(input: PrepProfileReadModelInput): PrepEvidenceRef[] {
    if (!input.resumeContextState || input.resumeContextState === "none") {
        return [];
    }

    return [{
        type: "resume_context",
        label: input.resumeContextState === "processed" ? "Processed resume context available" : "Resume context provided",
    }];
}

function buildAnalysisEvidenceRefs(questionId: string, analysis: AnalysisResult | undefined): PrepEvidenceRef[] {
    if (!analysis?.feedbackPlan) {
        return [];
    }

    return [{
        type: "feedback_plan",
        id: questionId,
        label: evidenceStateLabel(deriveEvidenceState(analysis)),
        excerpt: excerpt(analysis.feedbackPlan.centralRead),
    }];
}

function collectScores(analysis: AnalysisResult | undefined, dimensions: Dimension[]): number[] {
    if (!analysis?.scores) {
        return [];
    }

    return dimensions
        .map((dimension) => analysis.scores?.[dimension]?.score)
        .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
}

function average(scores: number[]): number | null {
    if (scores.length === 0) {
        return null;
    }
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function roundScore(score: number): number {
    return Math.round(score * 100) / 100;
}

function scoreToEvidenceState(score: number | null): PrepEvidenceState {
    if (score === null) {
        return "not_practiced";
    }
    if (score >= 4) {
        return "strong";
    }
    if (score >= 3) {
        return "clear";
    }
    if (score >= 1) {
        return "emerging";
    }
    return "not_practiced";
}

function scoreToFillPercent(score: number | null): number {
    if (score === null || score < 2 || score >= 4) {
        return 0;
    }
    if (score < 3) {
        return Math.round((score - 2) * 100);
    }
    return Math.round((score - 3) * 100);
}

function buildScoreLaneRefs(answers: Answer[], dimensions: Dimension[]): PrepEvidenceRef[] {
    return answers.flatMap((answer) => {
        const analysis = answer.analysis;
        if (!analysis?.scores) {
            return [];
        }

        const refs = buildAnalysisEvidenceRefs(answer.questionId, analysis);
        const scoredDimensions = dimensions
            .map((dimension) => analysis.scores?.[dimension] ? `${titleCaseDimension(dimension)}: ${analysis.scores[dimension].label}` : null)
            .filter((value): value is string => Boolean(value));
        if (scoredDimensions.length === 0) {
            return refs;
        }

        return [
            ...refs,
            {
                type: "feedback_plan" as const,
                id: answer.questionId,
                label: "Score evidence",
                excerpt: excerpt(scoredDimensions.join("; ")),
            },
        ];
    });
}

function normalizeQuestionCategory(category: string | undefined): {
    categoryId: PrepQuestionCategoryCard["categoryId"];
    label: string;
} | null {
    const presentation = getQuestionCategoryPresentation(category ?? "General");
    const normalized = presentation.label.toLowerCase().replace(/[^a-z]+/g, " ").trim();

    if (normalized.includes("screening")) {
        return { categoryId: "screening", label: "Screening" };
    }
    if (normalized.includes("case") || normalized.includes("scenario")) {
        return { categoryId: "case_scenario", label: "Case / Scenario" };
    }
    if (normalized.includes("technical") || normalized.includes("role specific")) {
        return { categoryId: "technical_role_specific", label: "Technical / Role-Specific" };
    }
    if (normalized.includes("culture") || normalized.includes("fit") || normalized.includes("perma")) {
        return { categoryId: "culture_fit", label: "Culture / Fit" };
    }
    if (normalized.includes("behavioral") || normalized.includes("star")) {
        return { categoryId: "behavioral", label: "Behavioral" };
    }

    return null;
}

function evidenceStateLabel(state: PrepEvidenceState): string {
    switch (state) {
        case "strong":
            return "Strong evidence shown";
        case "clear":
            return "Clear evidence in practice";
        case "emerging":
            return "Starting to build evidence";
        case "not_practiced":
        default:
            return "Not practiced yet";
    }
}

function deriveEvidenceState(analysis: AnalysisResult | undefined): PrepEvidenceState {
    if (!analysis?.feedbackPlan) {
        return "not_practiced";
    }

    const { signal, intervention } = analysis.feedbackPlan;
    if (
        signal.valence === "growth" ||
        signal.detectability === "thin" ||
        signal.detectability === "ambiguous" ||
        intervention.type === "repair_foundation"
    ) {
        return "emerging";
    }

    if (
        signal.valence === "strength" &&
        signal.detectability === "clear" &&
        intervention.type === "amplify_strength"
    ) {
        return "strong";
    }

    return "clear";
}

function mapFeedbackPlanToObservationState(analysis: AnalysisResult): PrepObservation["state"] {
    const signal = analysis.feedbackPlan?.signal;
    if (!signal || signal.detectability === "thin") {
        return "thin";
    }
    if (signal.valence === "growth" || signal.detectability === "ambiguous") {
        return "growth";
    }
    if (signal.valence === "strength") {
        return "strength";
    }
    return "mixed";
}

function addOrMergeSignal(signals: Map<string, SignalDraft>, next: SignalDraft): void {
    const existing = signals.get(next.signalId);
    if (!existing) {
        signals.set(next.signalId, next);
        return;
    }

    existing.evidenceState = strongerState(existing.evidenceState, next.evidenceState);
    existing.evidenceCounts = mergeEvidenceCounts(existing.evidenceCounts, next.evidenceCounts);
    existing.evidenceEvents.push(...next.evidenceEvents);
    existing.priority = strongerPriority(existing.priority, next.priority);
    existing.sourceRefs.push(...next.sourceRefs);
}

function finalizeSignal(signal: SignalDraft): PrepSignal {
    const { evidenceEvents, ...rest } = signal;
    return {
        ...rest,
        evidenceState: deriveRolledUpEvidenceState(signal.evidenceCounts, evidenceEvents),
        sourceRefs: dedupeRefs(signal.sourceRefs),
    };
}

function buildPrepRecommendation(input: PrepProfileReadModelInput, signals: PrepSignal[]): PrepRecommendation {
    if (input.activeSessionHref) {
        return {
            prepProfileId: input.prepProfileId,
            source: "unfinished_session",
            label: `Resume ${input.targetRole}`,
            reason: "You have an unfinished practice round for this target interview.",
            href: input.activeSessionHref,
            sourceRefs: [],
        };
    }

    const emergingSignal = signals.find((signal) => signal.evidenceCounts.emerging > 0);
    if (emergingSignal) {
        return {
            prepProfileId: input.prepProfileId,
            source: "answer_feedback",
            label: `Practice ${emergingSignal.label.toLowerCase()}`,
            reason: "Your latest feedback points to this as the most useful next practice focus.",
            href: "/practice",
            sourceRefs: emergingSignal.sourceRefs,
        };
    }

    const unpracticedSignal = signals.find((signal) => signal.evidenceState === "not_practiced");
    if (unpracticedSignal) {
        return {
            prepProfileId: input.prepProfileId,
            source: "first_practice",
            label: `Practice ${unpracticedSignal.label.toLowerCase()}`,
            reason: "This signal is part of the target interview context, but you have not built practice evidence for it yet.",
            href: "/practice",
            sourceRefs: unpracticedSignal.sourceRefs,
        };
    }

    return {
        prepProfileId: input.prepProfileId,
        source: input.summaryNarrative ? "session_summary" : "first_practice",
        label: "Keep building interview preparedness",
        reason: input.summaryNarrative
            ? "Use your latest session summary to choose the next practice focus."
            : "Start a practice round to build evidence for this target interview.",
        href: "/practice",
        sourceRefs: input.summaryNarrative ? [{ type: "summary", label: "Latest summary", excerpt: excerpt(input.summaryNarrative) }] : [],
    };
}

function strongerState(current: PrepEvidenceState, next: PrepEvidenceState): PrepEvidenceState {
    return STATE_RANK[next] > STATE_RANK[current] ? next : current;
}

function evidenceCountFor(state: PrepEvidenceState): Record<PrepEvidenceState, number> {
    return {
        ...EMPTY_EVIDENCE_COUNTS,
        [state]: 1,
    };
}

function evidenceEventsFor(state: PrepEvidenceState, observedAt?: number): SignalEvidenceEvent[] {
    return [{ state, observedAt }];
}

function mergeEvidenceCounts(
    current: Record<PrepEvidenceState, number>,
    next: Record<PrepEvidenceState, number>,
): Record<PrepEvidenceState, number> {
    return {
        not_practiced: current.not_practiced + next.not_practiced,
        emerging: current.emerging + next.emerging,
        clear: current.clear + next.clear,
        strong: current.strong + next.strong,
    };
}

function deriveRolledUpEvidenceState(
    counts: Record<PrepEvidenceState, number>,
    events: SignalEvidenceEvent[],
): PrepEvidenceState {
    const practicedEvents = events
        .map((event, index) => ({ ...event, index }))
        .filter((event) => event.state !== "not_practiced")
        .sort((a, b) => (a.observedAt ?? a.index) - (b.observedAt ?? b.index) || a.index - b.index);

    if (practicedEvents.length === 0) {
        return "not_practiced";
    }

    const latest = practicedEvents[practicedEvents.length - 1];
    if (latest.state === "strong") {
        return "strong";
    }

    if (latest.state === "clear") {
        if (counts.clear > 1 && counts.emerging === 0) {
            return "strong";
        }
        return latest.state;
    }

    const latestWeakRunLength = countLatestWeakRun(practicedEvents);
    if (latestWeakRunLength > 1) {
        return "emerging";
    }

    if (counts.strong > 0) {
        return "strong";
    }

    if (counts.clear > 0) {
        return "clear";
    }

    if (counts.clear > 1) {
        return "strong";
    }

    return "emerging";
}

function countLatestWeakRun(events: Array<SignalEvidenceEvent & { index: number }>): number {
    let count = 0;
    for (let index = events.length - 1; index >= 0; index -= 1) {
        if (events[index].state !== "emerging") {
            break;
        }
        count += 1;
    }
    return count;
}

function strongerPriority(
    current: PrepSignal["priority"],
    next: PrepSignal["priority"],
): PrepSignal["priority"] {
    const rank: Record<PrepSignal["priority"], number> = {
        background: 0,
        supporting: 1,
        primary: 2,
    };

    return rank[next] > rank[current] ? next : current;
}

function sortSignals(a: PrepSignal, b: PrepSignal): number {
    const priorityRank: Record<PrepSignal["priority"], number> = {
        primary: 0,
        supporting: 1,
        background: 2,
    };
    const priority = priorityRank[a.priority] - priorityRank[b.priority];
    if (priority !== 0) {
        return priority;
    }
    return a.label.localeCompare(b.label);
}

function dedupeRefs(refs: PrepEvidenceRef[]): PrepEvidenceRef[] {
    const seen = new Set<string>();
    return refs.filter((ref) => {
        const key = `${ref.type}:${ref.id ?? ""}:${ref.label}:${ref.excerpt ?? ""}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function excerpt(value: string | undefined, maxLength = 180): string | undefined {
    const normalized = value?.replace(/\s+/g, " ").trim();
    if (!normalized) {
        return undefined;
    }
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}
