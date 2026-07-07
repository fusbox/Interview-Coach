import React from "react";

const css = `
.rjs-pageintro{display:flex;flex-direction:column;gap:8px;font-family:var(--font-sans);}
.rjs-pageintro__eyebrow{font-size:12px;font-weight:var(--font-weight-semibold);text-transform:uppercase;letter-spacing:0.28em;color:rgb(var(--candidate-muted));margin:0;}
.rjs-pageintro__title{font-family:var(--font-display);font-size:clamp(1.75rem,4vw,2.5rem);line-height:1.02;font-weight:var(--font-weight-bold);color:rgb(var(--candidate-foreground));margin:0;}
.rjs-pageintro__description{max-width:42rem;font-size:1.0625rem;line-height:1.9;color:rgb(var(--candidate-muted));margin:0;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-pageintro-css")) {
    const s = document.createElement("style");
    s.id = "rjs-pageintro-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function PageIntro({ eyebrow, title, description, actions, className = "", ...rest }) {
    return (
        <div className={["rjs-pageintro", className].filter(Boolean).join(" ")} {...rest}>
            {eyebrow ? <p className="rjs-pageintro__eyebrow">{eyebrow}</p> : null}
            {title ? <h1 className="rjs-pageintro__title">{title}</h1> : null}
            {description ? <p className="rjs-pageintro__description">{description}</p> : null}
            {actions ? <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>{actions}</div> : null}
        </div>
    );
}
