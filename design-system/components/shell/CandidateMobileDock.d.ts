/**
 * Floating bottom nav capsule for mobile candidate views (glass, 44px hit targets).
 * @startingPoint section="Shell" subtitle="Mobile bottom dock" viewport="440x120"
 */
export interface CandidateMobileDockProps extends React.HTMLAttributes<HTMLElement> {
    activeLabel?: string;
    onNavigate?: (label: string) => void;
}
export declare function CandidateMobileDock(props: CandidateMobileDockProps): JSX.Element;
