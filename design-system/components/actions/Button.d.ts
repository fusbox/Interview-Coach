/**
 * Shared action button (shadcn system) used across recruiter + candidate surfaces.
 * @startingPoint section="Actions" subtitle="Primary / outline / ghost button system" viewport="700x220"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** shadcn variant axis (ignored when emphasis is set) */
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "info";
    /** shadcn size axis (ignored when density is set) */
    size?: "default" | "sm" | "lg" | "icon";
    /** system axis: overrides variant */
    emphasis?: "primary" | "secondary" | "tertiary" | "danger" | "link" | "info";
    /** system axis: compact 36px / default 40px / comfortable 44px / hero 48px */
    density?: "compact" | "default" | "comfortable" | "hero";
    /** app 24px / pill / square 16px corner treatment */
    shape?: "app" | "pill" | "square";
    /** label weight: default 500 / strong 600 / chrome uppercase micro */
    label?: "default" | "strong" | "chrome";
}
export declare function Button(props: ButtonProps): JSX.Element;
