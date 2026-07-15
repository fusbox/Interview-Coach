import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import CandidatePracticeIntentReadyPage, {
    renderCandidatePracticeIntentReadyPage,
} from "./page";
import type { CandidatePracticeIntentRecord } from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";

it("renders a recovery state when the durable follow-up practice intent cannot be confirmed", async () => {
    render(await CandidatePracticeIntentReadyPage({
        params: Promise.resolve({ intentId: "intent-1" }),
    }));

    expect(screen.getByRole("heading", { name: "Practice round is not ready yet." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Coach Plan" })).toHaveAttribute("href", "/candidate/dashboard");
});

it("renders a durable one-question follow-up practice intent", async () => {
    render(await renderCandidatePracticeIntentReadyPage({
        intentId: "intent-1",
        dependencies: {
            resolvePracticeIntent: async () => createPracticeIntentRecord([createIntentItem("slot-1")]),
        },
    }));

    expect(screen.getByRole("heading", { name: "Your focused practice is ready." })).toBeInTheDocument();
    expect(screen.getByText(/1 question from your Coach Plan is ready/i)).toBeInTheDocument();
    expect(screen.getByText("Material Handler I")).toBeInTheDocument();
    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.getByText("Screening")).toBeInTheDocument();
    expect(screen.getByText("What interests you about this Material Handler role?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start practice" })).toBeEnabled();
    expect(screen.getByRole("form", { name: "Start follow-up practice" })).toHaveAttribute(
        "action",
        "/candidate/practice/ready/intent-1/start",
    );
    expect(screen.getByRole("link", { name: "Return to Coach Plan" })).toHaveAttribute(
        "href",
        "/candidate/dashboard?prep=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
});

it("renders a durable multi-question follow-up practice intent without changing route shape", async () => {
    render(await renderCandidatePracticeIntentReadyPage({
        intentId: "intent-1",
        dependencies: {
            resolvePracticeIntent: async () => createPracticeIntentRecord([
                createIntentItem("slot-1"),
                createIntentItem("slot-2"),
                createIntentItem("slot-3"),
            ]),
        },
    }));

    expect(screen.getByText(/3 questions from your Coach Plan are ready/i)).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Selected practice questions" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByText("Q2")).toBeInTheDocument();
    expect(within(list).getByText("Behavioral")).toBeInTheDocument();
    expect(within(list).getByText("Tell me about a time you handled an inventory issue.")).toBeInTheDocument();
    expect(within(list).getByText("Q3")).toBeInTheDocument();
    expect(within(list).getByText("Culture / Fit")).toBeInTheDocument();
    expect(within(list).getByText("What work environment helps you do your best work?")).toBeInTheDocument();
});

function createPracticeIntentRecord(items: CandidatePracticeIntentRecord["items"]): CandidatePracticeIntentRecord {
    return {
        status: "candidate_practice_intent_record",
        candidatePracticeIntentId: "intent-1",
        candidateProfileId: "candidate-1",
        source: "practice_builder",
        lifecycleState: "ready",
        roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        targetInterviewId: "material handler i",
        targetRole: "Material Handler I",
        itemCount: items.length,
        setupContext: {
            targetRole: "Material Handler I",
            jobDescription: "Move materials safely.",
            interviewStage: "first_interview",
            questionCount: 3,
            resumeIncluded: false,
        },
        items,
        createdAt: "2026-07-12T12:00:00.000Z",
        updatedAt: "2026-07-12T12:01:00.000Z",
    };
}

function createIntentItem(questionKey: string): CandidatePracticeIntentRecord["items"][number] {
    const itemByKey = {
        "slot-1": {
            questionNumber: 1,
            category: "Screening",
            questionText: "What interests you about this Material Handler role?",
        },
        "slot-2": {
            questionNumber: 2,
            category: "Behavioral",
            questionText: "Tell me about a time you handled an inventory issue.",
        },
        "slot-3": {
            questionNumber: 3,
            category: "Culture / Fit",
            questionText: "What work environment helps you do your best work?",
        },
    }[questionKey] ?? {
        questionNumber: 99,
        category: "Practice",
        questionText: "Practice this question.",
    };

    return {
        kind: "practice_from_feedback",
        source: {
            kind: "coach_update_detail",
            candidatePracticeSessionId: "session-1",
            questionKey,
            targetInterviewId: "material handler i",
            targetRole: "Material Handler I",
            questionNumber: itemByKey.questionNumber,
            category: itemByKey.category,
            questionText: itemByKey.questionText,
            evidenceStatus: "practiced_with_coaching",
        },
        display: {
            label: "Practice from coach feedback",
            body: `I found the source coach read for Material Handler I, question ${itemByKey.questionNumber}.`,
        },
    };
}
