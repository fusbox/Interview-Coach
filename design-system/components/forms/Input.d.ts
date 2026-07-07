/**
 * Base text input (shadcn dialect): 40px, 8px radius, hairline border.
 * @startingPoint section="Forms" subtitle="Base text input" viewport="700x120"
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    className?: string;
}
export declare function Input(props: InputProps): JSX.Element;
