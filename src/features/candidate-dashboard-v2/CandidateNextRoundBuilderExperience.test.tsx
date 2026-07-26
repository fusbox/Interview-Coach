import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CandidateNextRoundBuilderModel } from "@/features/candidate-practice-v2/candidate-next-round-builder";

import {
    CandidateNextRoundBuilderExperience,
    CandidateNextRoundBuilderTrigger,
} from "./CandidateNextRoundBuilderExperience";

describe("CandidateNextRoundBuilderExperience", () => {
    it("expands a desktop builder leftward from the trigger's right edge", async () => {
        const user = userEvent.setup();
        const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
            matches: query === "(min-width: 48rem)",
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
        }));
        const triggerRight = window.innerWidth - 24;
        const triggerRect = {
            bottom: 72,
            height: 48,
            left: triggerRight - 180,
            right: triggerRight,
            top: 24,
            width: 180,
            x: triggerRight - 180,
            y: 24,
            toJSON: () => ({}),
        } as DOMRect;

        renderBuilder({ initialBuilder: createBuilder(0, 3) });
        const trigger = screen.getByRole("button", { name: "Next practice round" });
        vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(triggerRect);

        await user.click(trigger);

        const dialog = screen.getByRole("dialog", { name: "Next practice round" });
        expect(dialog).toHaveClass("is-anchored");
        expect(dialog.style.getPropertyValue("--next-round-anchor-right"))
            .toBe(`${window.innerWidth - triggerRect.right}px`);
        expect(dialog.style.getPropertyValue("--next-round-anchor-width")).toBe("180px");
        matchMedia.mockRestore();
    });

    it("opens from the truthful header count and supports add, reorder, and confirmed clear", async () => {
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

        const trigger = screen.getByRole("button", { name: "Next practice round, 1 queued" });
        await user.click(trigger);
        const dialog = screen.getByRole("dialog", { name: "Next practice round" });
        expect(within(dialog).getByText("Quality Inspector")).toBeInTheDocument();
        expect(within(dialog).getByText("1 of 20")).toBeInTheDocument();

        await user.click(within(dialog).getByRole("button", { name: "Add question 2 to next practice round" }));
        expect(requestMutation).toHaveBeenLastCalledWith(
            expect.objectContaining({ version: 3 }),
            {
                kind: "add",
                sourceCandidatePracticeSessionId: "session-1",
                sourceQuestionKey: "slot-2",
            },
        );
        expect(screen.getByRole("button", { name: "Next practice round, 2 queued" })).toBeInTheDocument();

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
        expect(within(dialog).getByText("Add questions from your Coach Plan to build this round.")).toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: "Start practice" })).toBeDisabled();
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

        await user.click(screen.getByRole("button", { name: "Next practice round, 1 queued" }));
        await user.click(screen.getByRole("button", { name: "Remove question 1 from next practice round" }));

        expect(screen.getByRole("status")).toHaveTextContent(
            "This round changed somewhere else. I loaded the latest version.",
        );
        expect(screen.getByRole("button", { name: "Next practice round" })).toBeInTheDocument();
        expect(screen.getByText("Add questions from your Coach Plan to build this round.")).toBeInTheDocument();
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

        await user.click(screen.getByRole("button", { name: "Next practice round, 1 queued" }));
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

        await user.click(screen.getByRole("button", { name: "Next practice round, 1 queued" }));
        const startPractice = screen.getByRole("button", { name: "Start practice" });
        fireEvent.click(startPractice);
        fireEvent.click(startPractice);

        expect(requestLaunch).toHaveBeenCalledOnce();
        resolveLaunch({
            ok: true,
            status: 201,
            outcome: "created",
            redirectTo: "/candidate/practice/ready/intent-1",
        });
        await waitFor(() => expect(navigate).toHaveBeenCalledWith("/candidate/practice/ready/intent-1"));
    });

    it("disables additional choices at the durable round capacity", async () => {
        const user = userEvent.setup();
        const atCapacity = { ...createBuilder(1, 3), capacity: 1 };
        renderBuilder({ initialBuilder: atCapacity });

        await user.click(screen.getByRole("button", { name: "Next practice round, 1 queued" }));

        expect(screen.getByRole("button", { name: "Add question 2 to next practice round" })).toBeDisabled();
        expect(screen.getByText("1 of 1")).toBeInTheDocument();
    });
});

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
            <CandidateNextRoundBuilderTrigger />
        </CandidateNextRoundBuilderExperience>,
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
