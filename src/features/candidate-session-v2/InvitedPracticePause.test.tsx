import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InvitedPracticePause } from "./InvitedPracticePause";

describe("invited practice pause", () => {
    it("offers an in-tab resume action", () => {
        const onResume = vi.fn();
        render(<InvitedPracticePause targetRole="Quality Inspector" onResume={onResume} />);

        fireEvent.click(screen.getByRole("button", { name: "Resume practice" }));
        expect(onResume).toHaveBeenCalledOnce();
    });

    it("explains that the candidate may close the window without offering a false action", () => {
        render(<InvitedPracticePause targetRole="Quality Inspector" onResume={vi.fn()} />);

        expect(screen.getByText(/close this window when you're ready/i)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /close window/i })).not.toBeInTheDocument();
    });
});
