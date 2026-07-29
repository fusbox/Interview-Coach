import type { ReactNode } from "react";

export const candidateV2Classes = {
    page: "page-center-frame",
    surfaceCard: "surface-card",
    eyebrow: "type-eyebrow",
    title: "type-display-md",
    body: "type-body-md muted-copy",
    appGrid: "app-grid",
    appGridWorkflow: "app-grid--workflow",
    appGridFormFlow: "app-grid--form-flow",
    appGridFocused: "app-grid--focused",
    grid12: "grid-12",
    mainRail: "layout-main-rail",
    readable: "layout-readable",
    sectionSpace: "section-space",
    onColorGlass: "on-color-glass",
    onColorAction: "on-color-action",
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
