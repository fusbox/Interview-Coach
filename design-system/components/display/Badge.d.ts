/**
 * Pill badge with semantic + readiness variants.
 * @startingPoint section="Display" subtitle="Pill badges (semantic + readiness)" viewport="700x120"
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "high" | "medium" | "low" | "unknown";
}
export declare function Badge(props: BadgeProps): JSX.Element;
