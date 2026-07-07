/**
 * Candidate desktop sidebar (16rem): brand, nav rows that scale on hover, active soft-blue pill.
 * @startingPoint section="Shell" subtitle="Candidate desktop sidebar" viewport="280x520"
 */
export interface CandidateSidebarProps extends React.HTMLAttributes<HTMLElement> {
    activeLabel?: string;
    /** TalentArbor logo src; falls back to wordmark */
    logoSrc?: string;
    onNavigate?: (label: string) => void;
    footer?: React.ReactNode;
}
export declare function CandidateSidebar(props: CandidateSidebarProps): JSX.Element;
