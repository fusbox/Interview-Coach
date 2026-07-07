/**
 * Centered empty state: icon in white circle, dashed border container.
 * @startingPoint section="Feedback" subtitle="Dashed empty state" viewport="700x340"
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    /** dashed container (default true) */
    border?: boolean;
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
