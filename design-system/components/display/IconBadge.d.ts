/**
 * Tinted rounded square that holds an icon — the icon-capsule pattern.
 * @startingPoint section="Display" subtitle="Tinted icon capsules" viewport="700x120"
 */
export interface IconBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "info" | "success" | "warning" | "critical" | "primary" | "brand";
    size?: "sm" | "md" | "lg";
    /** the icon element, e.g. <Icon name="clock" /> */
    children?: React.ReactNode;
}
export declare function IconBadge(props: IconBadgeProps): JSX.Element;
