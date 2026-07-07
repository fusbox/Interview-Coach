/**
 * Inline alert panel: state-tinted border + 5% wash, optional tone icon.
 * @startingPoint section="Feedback" subtitle="State-tinted inline alerts" viewport="700x200"
 */
export interface AlertPanelProps extends React.HTMLAttributes<HTMLDivElement> {
    tone?: "critical" | "success" | "info" | "warning";
    weight?: "medium" | "semibold";
    size?: "sm" | "md";
    /** true = tone icon; or pass a custom node */
    icon?: boolean | React.ReactNode;
}
export declare function AlertPanel(props: AlertPanelProps): JSX.Element;
