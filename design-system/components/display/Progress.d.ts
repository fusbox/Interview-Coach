/**
 * Rounded progress bar (blue fill on slate track).
 * @startingPoint section="Display" subtitle="Progress bar" viewport="700x100"
 */
export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
    /** 0–100 */
    value?: number;
}
export declare function Progress(props: ProgressProps): JSX.Element;
