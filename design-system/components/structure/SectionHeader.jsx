import React from "react";

const css = `
.rjs-sectionheader{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;font-family:var(--font-sans);}
.rjs-sectionheader__eyebrow{font-size:var(--text-micro-size);font-weight:var(--font-weight-bold);text-transform:uppercase;letter-spacing:0.1em;color:hsl(var(--text-muted));margin:0 0 4px;}
.rjs-sectionheader__title{font-weight:var(--font-weight-semibold);color:hsl(var(--text-primary));margin:0;line-height:1.2;}
.rjs-sectionheader--md .rjs-sectionheader__title{font-size:18px;}
.rjs-sectionheader--lg .rjs-sectionheader__title{font-size:24px;}
.rjs-sectionheader--sm .rjs-sectionheader__title{font-size:16px;}
.rjs-sectionheader__desc{font-size:14px;color:hsl(var(--text-muted));margin:4px 0 0;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-sectionheader-css")) {
    const s = document.createElement("style");
    s.id = "rjs-sectionheader-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function SectionHeader({ eyebrow, title, description, actions, size = "md", className = "", ...rest }) {
    return (
        <div className={["rjs-sectionheader", `rjs-sectionheader--${size}`, className].filter(Boolean).join(" ")} {...rest}>
            <div style={{ minWidth: 0 }}>
                {eyebrow ? <p className="rjs-sectionheader__eyebrow">{eyebrow}</p> : null}
                {title ? <h2 className="rjs-sectionheader__title">{title}</h2> : null}
                {description ? <p className="rjs-sectionheader__desc">{description}</p> : null}
            </div>
            {actions ? <div style={{ flexShrink: 0 }}>{actions}</div> : null}
        </div>
    );
}
