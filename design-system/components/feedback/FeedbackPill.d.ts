/**
 * Animated success pill ("Copied", "Saved") popping above the triggering element.
 * @startingPoint section="Feedback" subtitle="Transient success pill" viewport="700x120"
 */
export interface FeedbackPillProps {
    isVisible: boolean;
    text?: string;
    icon?: React.ReactNode;
    className?: string;
}
export declare function FeedbackPill(props: FeedbackPillProps): JSX.Element | null;
