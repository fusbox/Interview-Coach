/**
 * Error state with retry: rose-tinted container, alert icon in circle.
 * @startingPoint section="Feedback" subtitle="Error state with retry" viewport="700x360"
 */
export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    description?: string;
    icon?: React.ReactNode;
    onRetry?: () => void;
    /** raw error shown as code block */
    error?: Error | string;
}
export declare function ErrorState(props: ErrorStateProps): JSX.Element;
