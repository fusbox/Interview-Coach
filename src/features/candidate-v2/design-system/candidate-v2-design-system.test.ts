import { describe, expect, it } from "vitest";
import { candidateV2DesignSystem } from "./candidate-v2-design-system";

describe("candidateV2DesignSystem", () => {
    it("tracks the promoted candidate V2 shell classes", () => {
        expect(candidateV2DesignSystem.sourceReference).toBe(".untracked/design-system");
        expect(candidateV2DesignSystem.classNames.root).toBe("candidate-design-system");
        expect(candidateV2DesignSystem.classNames.page).toContain("candidate-design-system");
        expect(candidateV2DesignSystem.classNames.panel).toContain("border-[rgb(var(--candidate-border)/0.75)]");
        expect(candidateV2DesignSystem.classNames.eyebrow).toContain("eyebrow");
        expect(candidateV2DesignSystem.classNames.title).toContain("font-display");
    });

    it("names the tracked CSS tokens that V2 shells are allowed to rely on", () => {
        expect(candidateV2DesignSystem.tokens).toEqual({
            background: "--candidate-background",
            foreground: "--candidate-foreground",
            border: "--candidate-border",
            muted: "--candidate-muted",
            displayFont: "--font-display",
        });
    });

    it("keeps the candidate preparedness state vocabulary available to future V2 surfaces", () => {
        expect(candidateV2DesignSystem.prepStates).toEqual(["not_practiced", "emerging", "clear", "strong"]);
    });
});
