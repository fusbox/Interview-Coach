import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CandidateNextRoundBuilderModel } from "@/features/candidate-practice-v2/candidate-next-round-builder";

import {
    CandidateNextRoundBuilderExperience,
    CandidateNextRoundReviewFooter,
    useCandidateNextRoundBuilder,
} from "./CandidateNextRoundBuilderExperience";

describe("CandidateNextRoundBuilderExperience", () => {
    it("keeps the round handoff hidden while empty and opens the Plan workspace explicitly", async () => {
        const user = userEvent.setup();
        renderBuilder({ initialBuilder: createBuilder(0, 3) });

        expect(screen.queryByRole("button", { name: "Review next round" })).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Open next round" }));

        const dialog = screen.getByRole("dialog", { name: "Next round" });
        const nextRoundHeading = within(dialog).getByRole("heading", { name: "Next round" });
        expect(nextRoundHeading.closest("header")).toHaveClass("candidate-opened-surface-header");
        expect(within(nextRoundHeading.closest("header") as HTMLElement).getByLabelText("0 questions queued"))
            .toHaveTextContent("0");
        expect(within(dialog).getByRole("heading", { name: "Coach Plan" })).toBeInTheDocument();
        expect(within(dialog).getByText("Available to add")).toBeInTheDocument();
        expect(within(dialog).queryByRole("heading", { name: "Questions in your next round" }))
            .not.toBeInTheDocument();
    });

    it("opens from the review handoff and supports add, reorder, and confirmed clear", async () => {
        const user = userEvent.setup();
        const requestMutation = vi.fn(async (_builder, mutation) => {
            if (mutation.kind === "add") {
                return { ok: true, status: 200, outcome: "updated", builder: createBuilder(2, 4) };
            }
            if (mutation.kind === "reorder") {
                return { ok: true, status: 200, outcome: "updated", builder: createBuilder(2, 5) };
            }
            return { ok: true, status: 200, outcome: "updated", builder: createBuilder(0, 6) };
        });

        renderBuilder({ requestMutation });

        const trigger = screen.getByRole("button", { name: "Review next round" });
        await user.click(trigger);
        const dialog = screen.getByRole("dialog", { name: "Next round" });
        expect(within(dialog).queryByText("Quality Inspector")).not.toBeInTheDocument();
        expect(within(dialog).queryByText("Preparing for")).not.toBeInTheDocument();
        expect(within(dialog).queryByText("In this round")).not.toBeInTheDocument();
        expect(within(dialog).queryByText("1 of 20")).not.toBeInTheDocument();
        expect(within(dialog).queryByText("Coach feedback")).not.toBeInTheDocument();
        expect(within(dialog).queryByText("Plan coverage")).not.toBeInTheDocument();
        expect(within(dialog).getByRole("heading", { name: "Coach Plan" })).toBeInTheDocument();
        expect(within(dialog).getByText("Available to add")).toBeInTheDocument();
        const footerButtons = within(dialog.querySelector("footer")!).getAllByRole("button");
        expect(footerButtons.at(-1)).toHaveAccessibleName("Start practice");

        await user.click(within(dialog).getByRole("button", { name: "Add question 2 to next round" }));
        expect(requestMutation).toHaveBeenLastCalledWith(
            expect.objectContaining({ version: 3 }),
            {
                kind: "add",
                sourceCandidatePracticeSessionId: "session-1",
                sourceQuestionKey: "slot-2",
            },
        );
        expect(within(dialog).getByLabelText("2 questions queued")).toHaveTextContent("2");

        await user.click(within(dialog).getByRole("button", { name: "Move question 2 up" }));
        expect(requestMutation).toHaveBeenLastCalledWith(
            expect.objectContaining({ version: 4 }),
            { kind: "reorder", orderedItemIds: ["item-2", "item-1"] },
        );

        await user.click(within(dialog).getByRole("button", { name: "Clear all" }));
        const confirmation = screen.getByRole("alertdialog", { name: "Clear this next round?" });
        const keepQuestions = within(confirmation).getByRole("button", { name: "Keep questions" });
        const clearQuestions = within(confirmation).getByRole("button", { name: "Clear questions" });
        expect(keepQuestions).toHaveFocus();
        clearQuestions.focus();
        fireEvent.keyDown(document, { key: "Tab" });
        expect(keepQuestions).toHaveFocus();
        fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
        expect(clearQuestions).toHaveFocus();
        await user.click(clearQuestions);
        expect(requestMutation).toHaveBeenLastCalledWith(
            expect.objectContaining({ version: 5 }),
            { kind: "clear" },
        );
        expect(within(dialog).queryByRole("heading", { name: "Questions in your next round" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Review next round" })).not.toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: "Start practice" })).toBeDisabled();
    });

    it("shows pending feedback on the exact add, reorder, remove, and clear controls", async () => {
        const user = userEvent.setup();
        const addRequest = deferred<BuilderMutationResult>();
        const reorderRequest = deferred<BuilderMutationResult>();
        const removeRequest = deferred<BuilderMutationResult>();
        const clearRequest = deferred<BuilderMutationResult>();
        const requests = [addRequest, reorderRequest, removeRequest, clearRequest];
        const requestMutation = vi.fn(() => requests.shift()!.promise);

        renderBuilder({ requestMutation });
        await user.click(screen.getByRole("button", { name: "Review next round" }));
        const dialog = screen.getByRole("dialog", { name: "Next round" });

        const addQuestion = within(dialog).getByRole("button", { name: "Add question 2 to next round" });
        await user.click(addQuestion);
        expect(dialog).toHaveAttribute("aria-busy", "true");
        expect(addQuestion).toHaveAttribute("aria-busy", "true");
        expect(addQuestion).toHaveTextContent("Adding...");
        expect(addQuestion.querySelector(".ui-button__spinner")).toBeInTheDocument();
        expect(addQuestion.closest("li")).toHaveAttribute("aria-busy", "true");
        expect(within(dialog).getByRole("status")).toHaveTextContent(
            "Adding question 2 to your next round.",
        );
        expect(within(dialog).getByRole("button", { name: "Remove question 1 from next round" })).toBeDisabled();

        addRequest.resolve({ ok: true, status: 200, outcome: "updated", builder: createBuilder(2, 4) });
        await waitFor(() => expect(within(dialog).getByLabelText("2 questions queued")).toHaveTextContent("2"));

        const moveQuestion = within(dialog).getByRole("button", { name: "Move question 2 up" });
        await user.click(moveQuestion);
        expect(moveQuestion).toHaveAttribute("aria-busy", "true");
        expect(moveQuestion.querySelector(".ui-button__spinner")).toBeInTheDocument();
        expect(within(dialog).getByRole("status")).toHaveTextContent("Moving question 2 up.");

        reorderRequest.resolve({ ok: true, status: 200, outcome: "updated", builder: createBuilder(2, 5) });
        await waitFor(() => expect(moveQuestion).not.toHaveAttribute("aria-busy"));

        const removeQuestion = within(dialog).getByRole("button", { name: "Remove question 2 from next round" });
        await user.click(removeQuestion);
        expect(removeQuestion).toHaveAttribute("aria-busy", "true");
        expect(removeQuestion.querySelector(".ui-button__spinner")).toBeInTheDocument();
        expect(within(dialog).getByRole("status")).toHaveTextContent(
            "Removing question 2 from your next round.",
        );

        removeRequest.resolve({ ok: true, status: 200, outcome: "updated", builder: createBuilder(1, 6) });
        await waitFor(() => expect(within(dialog).queryByRole("button", {
            name: "Remove question 2 from next round",
        })).not.toBeInTheDocument());

        await user.click(within(dialog).getByRole("button", { name: "Clear all" }));
        await user.click(within(screen.getByRole("alertdialog", { name: "Clear this next round?" }))
            .getByRole("button", { name: "Clear questions" }));
        const clearing = within(dialog).getByRole("button", { name: "Clearing..." });
        expect(clearing).toHaveAttribute("aria-busy", "true");
        expect(clearing.querySelector(".ui-button__spinner")).toBeInTheDocument();
        expect(within(dialog).getByRole("status")).toHaveTextContent(
            "Clearing every question from your next round.",
        );

        clearRequest.resolve({ ok: true, status: 200, outcome: "updated", builder: createBuilder(0, 7) });
        await waitFor(() => expect(within(dialog).getByRole("button", { name: "Start practice" })).toBeDisabled());
        expect(requestMutation).toHaveBeenCalledTimes(4);
    });

    it("replaces stale state with the authoritative conflict response", async () => {
        const user = userEvent.setup();
        const latestBuilder = createBuilder(0, 9);
        renderBuilder({
            requestMutation: vi.fn(async () => ({
                ok: false,
                status: 409,
                outcome: "version_conflict",
                builder: latestBuilder,
            })),
        });

        await user.click(screen.getByRole("button", { name: "Review next round" }));
        await user.click(screen.getByRole("button", { name: "Remove question 1 from next round" }));

        expect(screen.getByRole("status")).toHaveTextContent(
            "This round changed somewhere else. I loaded the latest version.",
        );
        expect(screen.queryByRole("button", { name: "Review next round" })).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Coach Plan" })).toBeInTheDocument();
    });

    it("navigates only after launch returns a durable ready destination", async () => {
        const user = userEvent.setup();
        const navigate = vi.fn();
        renderBuilder({
            navigate,
            requestLaunch: vi.fn(async () => ({
                ok: true,
                status: 201,
                outcome: "created",
                redirectTo: "/candidate/practice/ready/intent-1",
            })),
        });

        await user.click(screen.getByRole("button", { name: "Review next round" }));
        await user.click(screen.getByRole("button", { name: "Start practice" }));

        expect(navigate).toHaveBeenCalledWith("/candidate/practice/ready/intent-1");
    });

    it("claims launch immediately so rapid activation emits one atomic request", async () => {
        const user = userEvent.setup();
        let resolveLaunch!: (value: { ok: boolean; status: number; outcome: string; redirectTo: string }) => void;
        const requestLaunch = vi.fn(() => new Promise<{
            ok: boolean;
            status: number;
            outcome: string;
            redirectTo: string;
        }>((resolve) => {
            resolveLaunch = resolve;
        }));
        const navigate = vi.fn();
        renderBuilder({ requestLaunch, navigate });

        await user.click(screen.getByRole("button", { name: "Review next round" }));
        const startPractice = screen.getByRole("button", { name: "Start practice" });
        fireEvent.click(startPractice);
        fireEvent.click(startPractice);

        expect(requestLaunch).toHaveBeenCalledOnce();
        expect(screen.getByRole("dialog", { name: "Next round" })).toHaveAttribute("aria-busy", "true");
        expect(startPractice).toBeDisabled();
        expect(startPractice).toHaveAttribute("aria-busy", "true");
        expect(startPractice).toHaveTextContent("Preparing practice...");
        expect(startPractice.querySelector(".ui-button__spinner")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Close Next round" })).toBeDisabled();
        expect(screen.getByRole("status")).toHaveTextContent("Preparing your next round.");
        resolveLaunch({
            ok: true,
            status: 201,
            outcome: "created",
            redirectTo: "/candidate/practice/ready/intent-1",
        });
        await waitFor(() => expect(navigate).toHaveBeenCalledWith("/candidate/practice/ready/intent-1"));
        expect(startPractice).toHaveAttribute("aria-busy", "true");
    });

    it("disables additional choices at the durable round capacity", async () => {
        const user = userEvent.setup();
        const atCapacity = { ...createBuilder(1, 3), capacity: 1 };
        renderBuilder({ initialBuilder: atCapacity });

        await user.click(screen.getByRole("button", { name: "Review next round" }));

        expect(screen.queryByRole("button", { name: "Add question 2 to next round" })).not.toBeInTheDocument();
        expect(screen.queryByText("1 of 1")).not.toBeInTheDocument();
        expect(screen.getByText("Round is full.")).toBeInTheDocument();
    });

    it("dismisses the mobile sheet after a deliberate downward grabber drag", async () => {
        const user = userEvent.setup();
        renderBuilder({ initialBuilder: createBuilder(1, 3) });
        const trigger = screen.getByRole("button", { name: "Review next round" });

        await user.click(trigger);
        const grabber = screen.getByTestId("candidate-next-round-sheet-grabber");
        fireEvent.pointerDown(grabber, { pointerId: 1, pointerType: "touch", clientY: 20 });
        fireEvent.pointerMove(grabber, { pointerId: 1, pointerType: "touch", clientY: 120 });
        fireEvent.pointerUp(grabber, { pointerId: 1, pointerType: "touch", clientY: 120 });

        expect(screen.queryByRole("dialog", { name: "Next round" })).not.toBeInTheDocument();
        await waitFor(() => expect(trigger).toHaveFocus());
    });
});

type BuilderMutationResult = {
    ok: boolean;
    status: number;
    outcome: string;
    builder: CandidateNextRoundBuilderModel;
};

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
}

function renderBuilder({
    requestMutation = vi.fn(async () => ({ ok: true, status: 200 })),
    requestLaunch = vi.fn(async () => ({ ok: false, status: 503 })),
    navigate = vi.fn(),
    initialBuilder = createBuilder(1, 3),
}: {
    requestMutation?: React.ComponentProps<typeof CandidateNextRoundBuilderExperience>["requestMutation"];
    requestLaunch?: React.ComponentProps<typeof CandidateNextRoundBuilderExperience>["requestLaunch"];
    navigate?: React.ComponentProps<typeof CandidateNextRoundBuilderExperience>["navigate"];
    initialBuilder?: CandidateNextRoundBuilderModel;
}) {
    return render(
        <CandidateNextRoundBuilderExperience
            initialBuilder={initialBuilder}
            requestMutation={requestMutation}
            requestLaunch={requestLaunch}
            navigate={navigate}
        >
            <BuilderOpenButton />
            <CandidateNextRoundReviewFooter />
        </CandidateNextRoundBuilderExperience>,
    );
}

function BuilderOpenButton() {
    const controller = useCandidateNextRoundBuilder();
    return (
        <button type="button" onClick={() => controller?.openBuilder()}>
            Open next round
        </button>
    );
}

function createBuilder(itemCount: 0 | 1 | 2, version: number): CandidateNextRoundBuilderModel {
    const allItems: CandidateNextRoundBuilderModel["items"] = [
        {
            candidateNextRoundDraftItemId: "item-1",
            sourceCandidatePracticeSessionId: "session-1",
            sourceQuestionKey: "slot-1",
            rootCandidatePracticeSessionId: "session-1",
            rootQuestionKey: "slot-1",
            practiceKind: "practice_from_feedback",
            provenance: "coach_update",
            displayPosition: 0,
            questionNumber: 1,
            category: "Screening",
            questionText: "Why this role?",
            evidenceLabel: "Coach feedback",
        },
        {
            candidateNextRoundDraftItemId: "item-2",
            sourceCandidatePracticeSessionId: "session-1",
            sourceQuestionKey: "slot-2",
            rootCandidatePracticeSessionId: "session-1",
            rootQuestionKey: "slot-2",
            practiceKind: "practice_missing_evidence",
            provenance: "coach_plan",
            displayPosition: 1,
            questionNumber: 2,
            category: "Behavioral",
            questionText: "Tell me about finding a defect.",
            evidenceLabel: "Plan coverage",
        },
    ];

    return {
        status: "candidate_next_round_builder_ready",
        candidateProfileId: "candidate-1",
        roleProfileId: "10000000-0000-4000-8000-000000000001",
        targetRole: "Quality Inspector",
        candidateNextRoundDraftId: "draft-1",
        version,
        itemCount,
        capacity: 20,
        items: allItems.slice(0, itemCount),
        choices: [
            {
                sourceCandidatePracticeSessionId: "session-1",
                sourceQuestionKey: "slot-1",
                rootCandidatePracticeSessionId: "session-1",
                rootQuestionKey: "slot-1",
                practiceKind: "practice_from_feedback",
                provenance: "coach_plan",
                questionNumber: 1,
                category: "Screening",
                questionText: "Why this role?",
                evidenceLabel: "Coach feedback",
                isQueued: itemCount >= 1,
            },
            {
                sourceCandidatePracticeSessionId: "session-1",
                sourceQuestionKey: "slot-2",
                rootCandidatePracticeSessionId: "session-1",
                rootQuestionKey: "slot-2",
                practiceKind: "practice_missing_evidence",
                provenance: "coach_plan",
                questionNumber: 2,
                category: "Behavioral",
                questionText: "Tell me about finding a defect.",
                evidenceLabel: "Plan coverage",
                isQueued: itemCount >= 2,
            },
        ],
    };
}
