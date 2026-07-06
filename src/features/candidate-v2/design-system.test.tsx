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
            gridMax: "--candidate-grid-max",
            gridGap: "--candidate-grid-gap",
            publicMax: "--layout-public-max",
            appMax: "--layout-app-max",
            readableMax: "--layout-readable-max",
            formMax: "--layout-form-max",
            sessionMax: "--layout-session-max",
            sidebarWidth: "--layout-sidebar-width",
            railWidth: "--layout-rail-width",
            headerHeight: "--layout-header-height",
        });
    });

    it("exposes the route-shell class recipes without relying on untracked files", () => {
        expect(candidateV2Classes.page).toContain("candidate-design-system");
        expect(candidateV2Classes.page).toContain("page-center-frame");
        expect(candidateV2Classes.surfaceCard).toBe("surface-card");
        expect(candidateV2Classes.eyebrow).toBe("type-eyebrow");
        expect(candidateV2Classes.title).toBe("type-display-md");
        expect(candidateV2Classes.body).toContain("type-body-md");
        expect(candidateV2Classes.body).toContain("muted-copy");
    });

    it("exposes layout primitives for page-frame composition", () => {
        expect(candidateV2Classes.appGrid).toBe("app-grid");
        expect(candidateV2Classes.grid12).toBe("grid-12");
        expect(candidateV2Classes.mainRail).toBe("layout-main-rail");
        expect(candidateV2Classes.readable).toBe("layout-readable");
        expect(candidateV2Classes.sectionSpace).toBe("section-space");
    });

    it("renders a candidate V2 surface with semantic heading and copy", () => {
        render(<CandidateV2Surface title="Dashboard V2" description="Coach Plan route shell" />);

        expect(screen.getByText("Candidate V2")).toHaveClass("type-eyebrow");
        expect(screen.getByRole("heading", { name: "Dashboard V2" })).toHaveClass("type-display-md");
        expect(screen.getByText("Coach Plan route shell")).toHaveClass("type-body-md");
    });
});
