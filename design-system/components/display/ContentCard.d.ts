/**
 * Density-tiered content container (default / spacious / hero).
 * @startingPoint section="Display" subtitle="Density-tiered container" viewport="700x200"
 */
export interface ContentCardProps extends React.HTMLAttributes<HTMLDivElement> {
    density?: "default" | "spacious" | "hero";
    align?: "left" | "center";
}
export declare function ContentCard(props: ContentCardProps): JSX.Element;
