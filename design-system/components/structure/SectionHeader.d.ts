/**
 * In-card section header: optional eyebrow, title, description, right-aligned actions.
 * @startingPoint section="Structure" subtitle="In-card section header" viewport="700x160"
 */
export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    eyebrow?: string;
    title?: string;
    description?: string;
    actions?: React.ReactNode;
    size?: "sm" | "md" | "lg";
}
export declare function SectionHeader(props: SectionHeaderProps): JSX.Element;
