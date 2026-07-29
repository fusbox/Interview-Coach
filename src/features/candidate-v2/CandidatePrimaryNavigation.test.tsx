import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CandidatePrimaryNavigation } from "@/features/candidate-v2/CandidatePrimaryNavigation";

beforeEach(() => {
    stubMobileDockViewport(true);
});

afterEach(() => {
    setWindowScrollY(0);
    vi.unstubAllGlobals();
});

it("hides while scrolling down and reveals while scrolling up or returning to the top", () => {
    render(<CandidatePrimaryNavigation activeDestination="setup" />);

    const navigation = screen.getByRole("navigation", { name: "Candidate" });
    expect(navigation).toHaveAttribute("data-dock-visibility", "visible");

    setWindowScrollY(120);
    fireEvent.scroll(window);
    expect(navigation).toHaveAttribute("data-dock-visibility", "hidden");

    setWindowScrollY(96);
    fireEvent.scroll(window);
    expect(navigation).toHaveAttribute("data-dock-visibility", "visible");

    setWindowScrollY(140);
    fireEvent.scroll(window);
    expect(navigation).toHaveAttribute("data-dock-visibility", "hidden");

    setWindowScrollY(12);
    fireEvent.scroll(window);
    expect(navigation).toHaveAttribute("data-dock-visibility", "visible");
});

it("reveals the dock when keyboard focus enters its navigation", () => {
    render(<CandidatePrimaryNavigation activeDestination="setup" />);

    const navigation = screen.getByRole("navigation", { name: "Candidate" });
    setWindowScrollY(120);
    fireEvent.scroll(window);
    expect(navigation).toHaveClass("is-dock-hidden");

    fireEvent.focus(screen.getByRole("link", { name: "Dashboard" }));
    expect(navigation).not.toHaveClass("is-dock-hidden");
});

it("keeps wider header navigation stable while the page scrolls", () => {
    stubMobileDockViewport(false);
    render(<CandidatePrimaryNavigation activeDestination="setup" />);

    const navigation = screen.getByRole("navigation", { name: "Candidate" });
    setWindowScrollY(240);
    fireEvent.scroll(window);

    expect(navigation).toHaveAttribute("data-dock-visibility", "visible");
});

function stubMobileDockViewport(matches: boolean) {
    vi.stubGlobal("matchMedia", () => ({
        matches,
        media: "(max-width: 719px)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    } satisfies MediaQueryList));
}

function setWindowScrollY(value: number) {
    Object.defineProperty(window, "scrollY", {
        configurable: true,
        value,
    });
}
