import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CandidateNextRoundBuilderModel } from "@/features/candidate-practice-v2/candidate-next-round-builder";

import {
    CandidateNextRoundBuilderExperience,
    CandidateNextRoundBuilderTrigger,
} from "./CandidateNextRoundBuilderExperience";
import { CandidateQuestionPracticeActions } from "./CandidatePracticeNextActions";

describe("CandidateQuestionPracticeActions", () => {
    it("keeps immediate practice separate from the shared durable queue state", async () => {
        const user = userEvent.setup();
        const requestMutation = vi.fn(async (_builder, mutation) => ({
            ok: true,
            status: 200,
            outcome: "updated",
            builder: mutation.kind === "add" ? createBuilder(true, 4) : createBuilder(false, 5),
        }));

        render(
            <CandidateNextRoundBuilderExperience
                initialBuilder={createBuilder(false, 3)}
                requestMutation={requestMutation}
            >
                <CandidateQuestionPracticeActions
                    pointer={{
                        rootCandidatePracticeSessionId: "baseline-session",
                        rootQuestionKey: "slot-1",
                    }}
                />
                <CandidateNextRoundBuilderTrigger />
            </CandidateNextRoundBuilderExperience>,
        );

        expect(screen.getByRole("link", { name: "Practice this now" })).toHaveAttribute(
            "href",
            "/candidate/practice/ready?intent=coach-update-feedback-focus&fromSession=latest-session&questionKey=slot-1",
        );
        expect(screen.getByRole("button", { name: "Next practice round" })).toBeInTheDocument();

        await user.click(screen.getByRole("switch", { name: "Add to next round" }));

        await waitFor(() => expect(requestMutation).toHaveBeenCalledWith(
            expect.objectContaining({ version: 3, itemCount: 0 }),
            {
                kind: "add",
                sourceCandidatePracticeSessionId: "latest-session",
                sourceQuestionKey: "slot-1",
            },
        ));
        expect(screen.getByRole("switch", { name: "Added to next round" })).toHaveAttribute("aria-checked", "true");
        expect(screen.getByRole("button", { name: "Next practice round, 1 queued" })).toBeInTheDocument();

        await user.click(screen.getByRole("switch", { name: "Added to next round" }));

        await waitFor(() => expect(requestMutation).toHaveBeenLastCalledWith(
            expect.objectContaining({ version: 4, itemCount: 1 }),
            { kind: "remove", candidateNextRoundDraftItemId: "item-1" },
        ));
        expect(screen.getByRole("switch", { name: "Add to next round" })).toHaveAttribute("aria-checked", "false");
        expect(screen.getByRole("button", { name: "Next practice round" })).toBeInTheDocument();
    });

    it("preserves a valid immediate action while suppressing an unresolvable queue claim", () => {
        render(
            <CandidateNextRoundBuilderExperience initialBuilder={createBuilder(false, 3)}>
                <CandidateQuestionPracticeActions
                    pointer={{
                        sourceCandidatePracticeSessionId: "unrelated-session",
                        sourceQuestionKey: "slot-9",
                    }}
                    practiceNowHref="/candidate/practice/ready?intent=coach-update-feedback-focus&fromSession=unrelated-session&questionKey=slot-9"
                />
            </CandidateNextRoundBuilderExperience>,
        );

        expect(screen.getByRole("link", { name: "Practice this now" })).toBeInTheDocument();
        expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    });

    it("loads authoritative state and explains a stale cross-tab mutation", async () => {
        const user = userEvent.setup();
        const requestMutation = vi.fn(async () => ({
            ok: false,
            status: 409,
            outcome: "version_conflict",
            builder: createBuilder(true, 8),
        }));
        render(
            <CandidateNextRoundBuilderExperience
                initialBuilder={createBuilder(false, 7)}
                requestMutation={requestMutation}
            >
                <CandidateQuestionPracticeActions
                    pointer={{
                        rootCandidatePracticeSessionId: "baseline-session",
                        rootQuestionKey: "slot-1",
                    }}
                />
            </CandidateNextRoundBuilderExperience>,
        );

        await user.click(screen.getByRole("switch", { name: "Add to next round" }));

        expect(await screen.findByRole("status")).toHaveTextContent(
            "This round changed somewhere else. I loaded the latest version.",
        );
        expect(screen.getByRole("switch", { name: "Added to next round" })).toHaveAttribute("aria-checked", "true");
    });
});

function createBuilder(isQueued: boolean, version: number): CandidateNextRoundBuilderModel {
    const item: CandidateNextRoundBuilderModel["items"][number] = {
        candidateNextRoundDraftItemId: "item-1",
        sourceCandidatePracticeSessionId: "latest-session",
        sourceQuestionKey: "slot-1",
        rootCandidatePracticeSessionId: "baseline-session",
        rootQuestionKey: "slot-1",
        practiceKind: "practice_from_feedback",
        provenance: "coach_update",
        displayPosition: 0,
        questionNumber: 1,
        category: "Screening",
        questionText: "Why this role?",
        evidenceLabel: "Coach feedback",
    };
    return {
        status: "candidate_next_round_builder_ready",
        candidateProfileId: "candidate-1",
        roleProfileId: "10000000-0000-4000-8000-000000000001",
        targetRole: "Quality Inspector",
        candidateNextRoundDraftId: "draft-1",
        version,
        itemCount: isQueued ? 1 : 0,
        capacity: 20,
        items: isQueued ? [item] : [],
        choices: [{
            sourceCandidatePracticeSessionId: "latest-session",
            sourceQuestionKey: "slot-1",
            rootCandidatePracticeSessionId: "baseline-session",
            rootQuestionKey: "slot-1",
            practiceKind: "practice_from_feedback",
            provenance: "coach_plan",
            questionNumber: 1,
            category: "Screening",
            questionText: "Why this role?",
            evidenceLabel: "Coach feedback",
            isQueued,
        }],
    };
}
