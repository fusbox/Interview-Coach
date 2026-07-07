/**
 * Metric display: uppercase micro title + semantic metric value, optional trend; pill variant for dense rows.
 * @startingPoint section="Display" subtitle="Stat card with trend" viewport="700x180"
 */
export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    value: string | number;
    description?: string;
    trend?: { value: string; positive?: boolean };
    variant?: "default" | "glass" | "pill";
    valueStyle?: React.CSSProperties;
}
export declare function MetricCard(props: MetricCardProps): JSX.Element;
