/**
 * Page header block: large SectionHeader over a bottom hairline divider.
 * @startingPoint section="Structure" subtitle="Divider page header" viewport="700x160"
 */
export interface PageHeaderBlockProps extends React.HTMLAttributes<HTMLDivElement> {
    eyebrow?: string;
    title?: string;
    description?: string;
    actions?: React.ReactNode;
    children?: React.ReactNode;
}
export declare function PageHeaderBlock(props: PageHeaderBlockProps): JSX.Element;
