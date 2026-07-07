/**
 * Purple survey card with 5-point emoji/numeric rating scale.
 * @startingPoint section="Feedback" subtitle="Emoji rating survey card" viewport="700x220"
 */
export interface FeedbackCardProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    scaleType?: "emoji" | "numeric";
    /** pill label after rating, e.g. "Saved" */
    successText?: string;
    lowLabel?: string;
    highLabel?: string;
    onRate?: (val: number) => void;
}
export declare function FeedbackCard(props: FeedbackCardProps): JSX.Element;
