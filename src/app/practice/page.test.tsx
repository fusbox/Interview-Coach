import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/practice-setup", () => ({
    PracticeSetupPage: () => <div>Practice setup feature boundary</div>,
}));

describe("/practice page", () => {
    it("delegates rendering to the practice setup feature", async () => {
        const { default: PracticePage } = await import("./page");

        render(<PracticePage />);

        expect(screen.getByText("Practice setup feature boundary")).toBeInTheDocument();
    });
});
