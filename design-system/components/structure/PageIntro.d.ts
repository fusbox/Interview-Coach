/**
 * Candidate page hero: eyebrow + display title + lede paragraph.
 * @startingPoint section="Structure" subtitle="Candidate page hero intro" viewport="700x220"
 */
export interface PageIntroProps extends React.HTMLAttributes<HTMLDivElement> {
    eyebrow?: string;
    title?: string;
    description?: string;
    actions?: React.ReactNode;
}
export declare function PageIntro(props: PageIntroProps): JSX.Element;
