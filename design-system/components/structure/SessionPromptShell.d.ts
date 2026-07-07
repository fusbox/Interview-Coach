/**
 * Glass panel that frames an active practice question/prompt.
 * @startingPoint section="Structure" subtitle="Glass prompt panel" viewport="700x260"
 */
export interface SessionPromptShellProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
}
export declare function SessionPromptShell(props: SessionPromptShellProps): JSX.Element;
