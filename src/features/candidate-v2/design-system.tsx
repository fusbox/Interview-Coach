import type { ReactNode } from "react";

export const candidateV2Tokens = {
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
} as const;

export const candidateV2Classes = {
    page: "candidate-design-system candidate-v2-page",
    surfaceCard: "candidate-v2-surface-card",
    eyebrow: "type-eyebrow",
    title: "type-display-md",
    body: "type-body-md candidate-v2-muted-copy",
} as const;

type CandidateV2SurfaceProps = {
    eyebrow?: string;
    title: string;
    description?: string;
    children?: ReactNode;
};

export function CandidateV2Surface({ eyebrow = "Candidate V2", title, description, children }: CandidateV2SurfaceProps) {
    return (
        <section className={candidateV2Classes.surfaceCard}>
            <p className={candidateV2Classes.eyebrow}>{eyebrow}</p>
            <h1 className={candidateV2Classes.title}>{title}</h1>
            {description ? <p className={candidateV2Classes.body}>{description}</p> : null}
            {children}
        </section>
    );
}
