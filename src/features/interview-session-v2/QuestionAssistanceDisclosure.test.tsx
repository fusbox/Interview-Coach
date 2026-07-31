import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuestionAssistanceDisclosure } from "./QuestionAssistanceDisclosure";

const hintsOutput = {
    status: "candidate_question_hints_v1",
    doThis: "Choose one relevant example and make your own actions and result clear.",
    avoidThis: "Avoid a general claim that does not show what you personally did.",
};
const strongResponseOutput = {
    status: "candidate_strong_response_v1",
    strongResponse:
        "I became interested in this role because it combines careful work with service. In my last position, I checked each order, documented discrepancies, and worked with the team to correct them before shipment.",
    whyThisWorks:
        "It answers directly and supports the interest with a concrete example. It also keeps the candidate's actions visible.",
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("QuestionAssistanceDisclosure", () => {
    it("generates hints automatically and generates a strong response only when requested", async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
            const body = JSON.parse(String(init?.body)) as { assistanceKind: string };
            const output = body.assistanceKind === "hints"
                ? hintsOutput
                : strongResponseOutput;
            return Response.json({ status: "ready", output });
        });
        vi.stubGlobal("fetch", fetchMock);

        render(
            <QuestionAssistanceDisclosure
                endpoint="/candidate/session/session-1/question-assistance"
                questionKey="slot-1"
            />,
        );

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
            questionKey: "slot-1",
            assistanceKind: "hints",
        });

        await user.click(screen.getByRole("button", { name: "Hints" }));
        expect(await screen.findByText(hintsOutput.doThis)).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole("button", { name: "Strong response" }));
        expect(await screen.findByText(strongResponseOutput.strongResponse)).toBeInTheDocument();
        const selectedStrongResponse = screen.getByRole("button", { name: "Strong response" });
        expect(selectedStrongResponse).toHaveAttribute("aria-pressed", "true");
        expect(selectedStrongResponse).toHaveAttribute("aria-expanded", "true");
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
            questionKey: "slot-1",
            assistanceKind: "strong_response",
        });
    });

    it("shows truthful loading and retry states", async () => {
        const user = userEvent.setup();
        let resolveStrongResponse!: (response: Response) => void;
        const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
            const body = JSON.parse(String(init?.body)) as { assistanceKind: string };
            if (body.assistanceKind === "hints") {
                return Response.json({ status: "ready", output: hintsOutput });
            }
            return new Promise<Response>((resolve) => {
                resolveStrongResponse = resolve;
            });
        });
        vi.stubGlobal("fetch", fetchMock);

        render(
            <QuestionAssistanceDisclosure
                endpoint="/candidate/session/session-1/question-assistance"
                questionKey="slot-1"
            />,
        );
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

        await user.click(screen.getByRole("button", { name: "Strong response" }));
        expect(screen.getByText("Preparing a strong response example...")).toBeInTheDocument();

        resolveStrongResponse(Response.json(
            { error: "Question assistance is unavailable.", retryable: true },
            { status: 503 },
        ));
        expect(await screen.findByText("A strong response is not available right now."))
            .toBeInTheDocument();

        const retryResponse = Response.json({ status: "ready", output: strongResponseOutput });
        fetchMock.mockResolvedValueOnce(retryResponse);
        await user.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByText(strongResponseOutput.strongResponse)).toBeInTheDocument();
    });

    it("closes open assistance when the active question changes or controls are disabled", async () => {
        const user = userEvent.setup();
        vi.stubGlobal("fetch", vi.fn(async () => (
            Response.json({ status: "ready", output: hintsOutput })
        )));
        const view = render(
            <QuestionAssistanceDisclosure
                endpoint="/candidate/session/session-1/question-assistance"
                questionKey="slot-1"
            />,
        );

        await user.click(screen.getByRole("button", { name: "Hints" }));
        expect(await screen.findByRole("dialog", { name: "Hints & framework" })).toBeInTheDocument();

        view.rerender(
            <QuestionAssistanceDisclosure
                disabled
                endpoint="/candidate/session/session-1/question-assistance"
                questionKey="slot-2"
            />,
        );

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(screen.getByRole("button", { name: "Hints" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Strong response" })).toBeDisabled();
    });
});
