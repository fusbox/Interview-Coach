export const candidateV2DesignSystem = {
    sourceReference: ".untracked/design-system",
    classNames: {
        root: "candidate-design-system",
        page: "candidate-design-system min-h-screen bg-[rgb(var(--candidate-background))] px-6 py-10 text-[rgb(var(--candidate-foreground))]",
        panel: "mx-auto max-w-3xl rounded-[2rem] border border-[rgb(var(--candidate-border)/0.75)] bg-white p-8 shadow-[0_18px_45px_rgba(15,33,57,0.08)]",
        eyebrow: "eyebrow mb-3",
        title: "font-display text-3xl font-bold",
        body: "mt-4 text-sm leading-6 text-[rgb(var(--candidate-muted))]",
    },
    tokens: {
        background: "--candidate-background",
        foreground: "--candidate-foreground",
        border: "--candidate-border",
        muted: "--candidate-muted",
        displayFont: "--font-display",
    },
    prepStates: ["not_practiced", "emerging", "clear", "strong"],
} as const;

export type CandidateV2PrepState = (typeof candidateV2DesignSystem.prepStates)[number];
