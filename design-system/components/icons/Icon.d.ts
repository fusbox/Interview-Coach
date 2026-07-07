/**
 * Lucide stroke icon by name. The product's only icon system.
 * @startingPoint section="Primitives" subtitle="Lucide stroke icons by name" viewport="700x160"
 */
export interface IconProps {
    /** Lucide icon name, e.g. "plus", "search", "check-circle", "layout-dashboard" */
    name: string;
    /** px size (default 20) */
    size?: number;
    /** stroke width (default 2; use 2.5 for small emphasized glyphs) */
    strokeWidth?: number;
    style?: React.CSSProperties;
    className?: string;
}
export declare function Icon(props: IconProps): JSX.Element;
