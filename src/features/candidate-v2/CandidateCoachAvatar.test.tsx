import { render } from "@testing-library/react";
import { expect, it } from "vitest";

import { CandidateCoachAvatar } from "./CandidateCoachAvatar";

it("renders the calm light and dark coach assets decoratively by default", () => {
    const { container } = render(<CandidateCoachAvatar />);
    const images = container.querySelectorAll("img");

    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "/coach-avatar-calm-light.svg");
    expect(images[1]).toHaveAttribute("src", "/coach-avatar-calm-dark.svg");
    expect(images[0]).toHaveAttribute("alt", "");
    expect(images[1]).toHaveAttribute("alt", "");
});

it("selects the CTA asset pair without changing coach-avatar semantics", () => {
    const { container } = render(<CandidateCoachAvatar variant="cta" />);
    const images = container.querySelectorAll("img");

    expect(images[0]).toHaveAttribute("src", "/coach-avatar-cta-light.svg");
    expect(images[1]).toHaveAttribute("src", "/coach-avatar-cta-dark.svg");
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
});

it("selects the higher-contrast surface asset pair for light coach surfaces", () => {
    const { container } = render(<CandidateCoachAvatar variant="surface" />);
    const images = container.querySelectorAll("img");

    expect(images[0]).toHaveAttribute("src", "/coach-avatar-surface-light.svg");
    expect(images[1]).toHaveAttribute("src", "/coach-avatar-surface-dark.svg");
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
});
