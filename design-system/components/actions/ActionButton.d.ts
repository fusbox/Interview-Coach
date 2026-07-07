/**
 * Candidate-dialect pill CTA with blue glow — the job-seeker primary action.
 * @startingPoint section="Actions" subtitle="Candidate pill CTA with blue glow" viewport="700x160"
 */
export interface ActionButtonProps {
    /** renders an <a> when set */
    href?: string;
    /** outline style on white */
    secondary?: boolean;
    size?: "default" | "large";
    disabled?: boolean;
    className?: string;
    type?: "button" | "submit" | "reset";
    onClick?: (e: React.MouseEvent) => void;
    children: React.ReactNode;
}
export declare function ActionButton(props: ActionButtonProps): JSX.Element;
