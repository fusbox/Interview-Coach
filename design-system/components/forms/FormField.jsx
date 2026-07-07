import React from "react";

const css = `
.rjs-fieldgroup{display:flex;flex-direction:column;gap:12px;}
.rjs-fieldlabel{font-size:var(--text-micro-size);line-height:var(--text-micro-line);letter-spacing:0.05em;font-weight:var(--font-weight-bold);text-transform:uppercase;color:hsl(var(--text-secondary));margin-left:4px;font-family:var(--font-sans);}
.rjs-fieldhint{font-size:var(--text-micro-size);line-height:var(--text-micro-line);color:hsl(var(--text-muted));font-style:italic;margin:0 0 0 4px;font-family:var(--font-sans);}
.rjs-textfield,.rjs-selectfield{display:flex;height:48px;width:100%;border-radius:var(--radius-xl);border:1px solid hsl(var(--border));background:hsl(var(--surface-subtle));padding:8px 16px;font-size:14px;font-family:var(--font-sans);color:hsl(var(--text-primary));transition:all var(--duration-base) var(--ease-standard);box-sizing:border-box;}
.rjs-textareafield{display:flex;min-height:120px;width:100%;border-radius:var(--radius-xl);border:1px solid hsl(var(--border));background:hsl(var(--surface-subtle));padding:12px 16px;font-size:14px;line-height:1.625;font-family:var(--font-sans);color:hsl(var(--text-primary));transition:all var(--duration-base) var(--ease-standard);box-sizing:border-box;resize:vertical;}
.rjs-textfield:focus,.rjs-textareafield:focus,.rjs-selectfield:focus{outline:none;border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.2);}
.rjs-textfield::placeholder,.rjs-textareafield::placeholder{color:hsl(var(--muted-foreground));}
.rjs-selectfield{appearance:none;cursor:pointer;align-items:center;justify-content:space-between;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-formfield-css")) {
    const s = document.createElement("style");
    s.id = "rjs-formfield-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function FieldGroup({ className = "", ...rest }) {
    return <div className={["rjs-fieldgroup", className].filter(Boolean).join(" ")} {...rest} />;
}

export function FieldLabel({ className = "", ...rest }) {
    return <label className={["rjs-fieldlabel", className].filter(Boolean).join(" ")} {...rest} />;
}

export function FieldHint({ className = "", ...rest }) {
    return <p className={["rjs-fieldhint", className].filter(Boolean).join(" ")} {...rest} />;
}

/** Labelled field: label + control (text/textarea/select) + optional hint. */
export function FormField({ label, hint, kind = "text", inputProps = {}, children }) {
    return (
        <FieldGroup>
            {label ? <FieldLabel>{label}</FieldLabel> : null}
            {children
                ? children
                : kind === "textarea"
                    ? <textarea className="rjs-textareafield" {...inputProps} />
                    : kind === "select"
                        ? <select className="rjs-selectfield" {...inputProps} />
                        : <input className="rjs-textfield" {...inputProps} />}
            {hint ? <FieldHint>{hint}</FieldHint> : null}
        </FieldGroup>
    );
}
