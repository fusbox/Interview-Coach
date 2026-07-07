/**
 * Uppercase status pill with tint recipe (50-bg / 200-border / 800-text) and auto icon.
 * @startingPoint section="Display" subtitle="Uppercase status pills with icons" viewport="700x160"
 */
export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "success" | "warning" | "critical" | "info" | "neutral" | "readinessHigh" | "readinessPotential" | "readinessMedium" | "readinessLow" | "progressIdle" | "progressStarted" | "progressSolid" | "progressComplete";
    size?: "sm" | "md" | "lg";
    fullWidth?: boolean;
    /** show the semantic icon (default true) */
    icon?: boolean;
}
export declare function StatusBadge(props: StatusBadgeProps): JSX.Element;
