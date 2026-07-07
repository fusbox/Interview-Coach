/**
 * Rounded search input with leading search icon that tints primary on focus.
 * @startingPoint section="Forms" subtitle="Rounded search input" viewport="700x120"
 */
export interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    wrapperClassName?: string;
}
export declare function SearchField(props: SearchFieldProps): JSX.Element;
