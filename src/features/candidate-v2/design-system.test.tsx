import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CandidateV2Surface, candidateV2Classes, candidateV2Tokens } from "./design-system";

describe("candidate V2 design system primitives", () => {
    it("names the tracked candidate token contract used by V2 route shells", () => {
        expect(candidateV2Tokens).toEqual({
            background: "--candidate-background",
            surface: "--candidate-surface",
            border: "--candidate-border",
            foreground: "--candidate-foreground",
            muted: "--candidate-muted",
            primary: "--candidate-primary",
            primarySoft: "--candidate-primary-soft",
            shadowCard: "--candidate-shadow-card",
            fontSans: "--font-sans",
            fontDisplay: "--font-display",
        });
    });

    it("exposes the route-shell class recipes without relying on untracked files", () => {
        expect(candidateV2Classes.page).toContain("candidate-design-system");
        expect(candidateV2Classes.surfaceCard).toBe("candidate-v2-surface-card");
        expect(candidateV2Classes.eyebrow).toBe("type-eyebrow");
        expect(candidateV2Classes.title).toBe("type-display-md");
        expect(candidateV2Classes.body).toContain("type-body-md");
    });

    it("renders a candidate V2 surface with semantic heading and copy", () => {
        render(<CandidateV2Surface title="Dashboard V2" description="Coach Plan route shell" />);

        expect(screen.getByText("Candidate V2")).toHaveClass("type-eyebrow");
        expect(screen.getByRole("heading", { name: "Dashboard V2" })).toHaveClass("type-display-md");
        expect(screen.getByText("Coach Plan route shell")).toHaveClass("type-body-md");
    });
});
