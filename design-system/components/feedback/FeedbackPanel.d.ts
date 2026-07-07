/**
 * Coach feedback card: left accent border colored by assessment + assessment badge.
 * @startingPoint section="Feedback" subtitle="Assessment feedback card" viewport="700x220"
 */
export interface FeedbackPanelProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    body: string | React.ReactNode;
    assessment?: "outstanding" | "satisfactory" | "growth" | "critical";
    icon?: React.ReactNode;
}
export declare function FeedbackPanel(props: FeedbackPanelProps): JSX.Element;
