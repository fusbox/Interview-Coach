import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
    getSearchParam: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => ({
        get: navigation.getSearchParam,
    }),
}));

import CandidateSessionLoading from "./loading";

beforeEach(() => {
    navigation.getSearchParam.mockReset();
});

it("keeps routed entry inside the practice transition while the session loads", () => {
    navigation.getSearchParam.mockImplementation((name: string) => name === "entry" ? "1" : null);

    render(<CandidateSessionLoading />);

    expect(screen.getByRole("heading", { name: "Entering practice space" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Loading Interview Coach")).not.toBeInTheDocument();
});

it("uses the recovery skeleton when the session is not a routed entry", () => {
    navigation.getSearchParam.mockReturnValue(null);

    render(<CandidateSessionLoading />);

    expect(screen.getByLabelText("Loading Interview Coach")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Entering practice space" })).not.toBeInTheDocument();
});
