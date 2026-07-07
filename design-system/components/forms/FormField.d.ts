/**
 * Labelled form field: micro uppercase label + 48px subtle-fill control + italic hint.
 * @startingPoint section="Forms" subtitle="Label + control + hint stack" viewport="700x180"
 */
export interface FormFieldProps {
    /** micro uppercase label */
    label?: string;
    /** italic hint below the control */
    hint?: string;
    kind?: "text" | "textarea" | "select";
    /** props forwarded to the underlying control */
    inputProps?: Record<string, unknown>;
    /** custom control instead of the built-in one */
    children?: React.ReactNode;
}
export declare function FormField(props: FormFieldProps): JSX.Element;
export declare function FieldGroup(props: React.HTMLAttributes<HTMLDivElement>): JSX.Element;
export declare function FieldLabel(props: React.LabelHTMLAttributes<HTMLLabelElement>): JSX.Element;
export declare function FieldHint(props: React.HTMLAttributes<HTMLParagraphElement>): JSX.Element;
