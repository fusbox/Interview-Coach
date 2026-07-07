/**
 * Candidate-dialect section card: 24px widget/card radius, soft diffuse shadow, optional eyebrow/title/description header.
 * @startingPoint section="Display" subtitle="Candidate section card" viewport="700x240"
 */
export interface SurfaceCardProps extends React.HTMLAttributes<HTMLElement> {
    title?: string;
    /** ALL-CAPS tracked label above the title */
    eyebrow?: string;
    description?: string;
    children?: React.ReactNode;
}
export declare function SurfaceCard(props: SurfaceCardProps): JSX.Element;
