import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CANDIDATE_THEME_STORAGE_KEY } from "./candidate-theme";
import { CandidateThemeSwitcher } from "./CandidateThemeSwitcher";

describe("CandidateThemeSwitcher", () => {
    beforeEach(() => {
        window.localStorage.clear();
        resetDocumentTheme();
    });

    afterEach(() => {
        resetDocumentTheme();
    });

    it("applies and persists an explicit dark theme choice", async () => {
        render(<CandidateThemeSwitcher />);

        const switcher = await screen.findByRole("button", { name: "Switch to dark theme" });
        fireEvent.click(switcher);

        expect(document.documentElement).toHaveClass("dark");
        expect(document.documentElement).toHaveAttribute("data-theme", "dark");
        expect(document.documentElement.style.colorScheme).toBe("dark");
        expect(window.localStorage.getItem(CANDIDATE_THEME_STORAGE_KEY)).toBe("dark");
        const updatedSwitcher = screen.getByRole("button", { name: "Switch to light theme" });
        expect(updatedSwitcher.textContent).toBe("");
        expect(updatedSwitcher.querySelector('[data-active="true"]')).toBe(
            updatedSwitcher.querySelectorAll(".candidate-theme-switcher__option")[1],
        );
    });

    it("reflects a dark theme applied by the pre-hydration bootstrap", async () => {
        document.documentElement.classList.add("dark");
        document.documentElement.dataset.theme = "dark";
        document.documentElement.style.colorScheme = "dark";

        render(<CandidateThemeSwitcher />);

        await waitFor(() => {
            const switcher = screen.getByRole("button", { name: "Switch to light theme" });
            expect(switcher.querySelector('[data-active="true"]')).toBe(
                switcher.querySelectorAll(".candidate-theme-switcher__option")[1],
            );
        });
    });
});

function resetDocumentTheme() {
    document.documentElement.classList.remove("dark");
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = "";
}
