/**
 * Selectable rating/choice button: emoji square, chip, or compact pill.
 * @startingPoint section="Forms" subtitle="Emoji / chip / compact choice buttons" viewport="700x160"
 */
export interface FeedbackChoiceButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    kind?: "emoji" | "chip" | "compact";
    selected?: boolean;
    tone?: "primary" | "success" | "neutral";
}
export declare function FeedbackChoiceButton(props: FeedbackChoiceButtonProps): JSX.Element;
/** The product's 5-point emoji rating scale (the ONLY emoji usage in the brand). */
export declare const EMOJI_SCALE: Array<{ val: number; emoji: string }>;
