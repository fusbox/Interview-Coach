/**
 * Soft-tinted insight container (positive / caution / highlight / neutral).
 * @startingPoint section="Display" subtitle="Tinted insight container" viewport="700x140"
 */
export interface InsightCardProps extends React.HTMLAttributes<HTMLDivElement> {
    tone?: "positive" | "caution" | "highlight" | "neutral";
}
export declare function InsightCard(props: InsightCardProps): JSX.Element;
