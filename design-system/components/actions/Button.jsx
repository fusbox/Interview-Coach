import React from "react";

const css = `
.rjs-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;border:1px solid transparent;cursor:pointer;font-family:var(--font-sans);text-decoration:none;transition:all var(--duration-base) var(--ease-standard);}
.rjs-btn:active{transform:scale(0.98);}
.rjs-btn:disabled{pointer-events:none;opacity:.5;}
.rjs-btn:focus-visible{outline:2px solid hsl(var(--ring));outline-offset:2px;}
.rjs-btn--default,.rjs-btn--primary{background:hsl(var(--primary));color:hsl(var(--primary-foreground));box-shadow:var(--shadow-raised-1);}
.rjs-btn--default:hover,.rjs-btn--primary:hover{background:hsl(var(--primary)/0.9);box-shadow:var(--shadow-raised-2);}
.rjs-btn--destructive,.rjs-btn--danger{background:hsl(var(--destructive));color:hsl(var(--destructive-foreground));box-shadow:var(--shadow-raised-1);}
.rjs-btn--destructive:hover,.rjs-btn--danger:hover{background:hsl(var(--destructive)/0.9);box-shadow:var(--shadow-raised-2);}
.rjs-btn--outline,.rjs-btn--secondary-emphasis{border-color:hsl(var(--input));background:hsl(var(--background));color:hsl(var(--text-primary));box-shadow:var(--shadow-flat);}
.rjs-btn--outline:hover,.rjs-btn--secondary-emphasis:hover{background:hsl(var(--surface-subtle));box-shadow:var(--shadow-raised-1);}
.rjs-btn--secondary{background:hsl(var(--secondary));color:hsl(var(--secondary-foreground));}
.rjs-btn--secondary:hover{background:hsl(var(--secondary)/0.8);}
.rjs-btn--ghost{background:transparent;color:hsl(var(--text-primary));}
.rjs-btn--ghost:hover{background:hsl(var(--surface-subtle));}
.rjs-btn--tertiary{background:transparent;color:hsl(var(--primary));box-shadow:none;}
.rjs-btn--tertiary:hover{background:hsl(var(--primary)/0.05);}
.rjs-btn--link{background:transparent;color:hsl(var(--primary));text-underline-offset:4px;box-shadow:none;}
.rjs-btn--link:hover{text-decoration:underline;}
.rjs-btn--info{background:hsl(var(--state-info));color:hsl(var(--primary-foreground));box-shadow:var(--shadow-raised-1);}
.rjs-btn--info:hover{background:hsl(var(--state-info)/0.9);box-shadow:var(--shadow-raised-2);}
.rjs-btn--size-default{height:40px;border-radius:var(--radius-md);padding:8px 16px;font-size:14px;font-weight:var(--font-weight-medium);}
.rjs-btn--size-sm{height:36px;border-radius:var(--radius-md);padding:0 12px;font-size:14px;font-weight:var(--font-weight-medium);}
.rjs-btn--size-lg{height:44px;border-radius:var(--radius-md);padding:0 32px;font-size:14px;font-weight:var(--font-weight-medium);}
.rjs-btn--size-icon{height:40px;width:40px;border-radius:var(--radius-md);padding:0;font-size:14px;}
.rjs-btn--density-compact{height:36px;padding:0 12px;font-size:14px;}
.rjs-btn--density-default{height:40px;padding:8px 16px;font-size:14px;}
.rjs-btn--density-comfortable{height:44px;padding:0 24px;font-size:14px;}
.rjs-btn--density-hero{height:48px;padding:0 32px;font-size:16px;}
.rjs-btn--shape-app{border-radius:var(--radius-2xl);}
.rjs-btn--shape-pill{border-radius:9999px;}
.rjs-btn--shape-square{border-radius:var(--radius-xl);}
.rjs-btn--label-default{font-weight:var(--font-weight-medium);text-transform:none;letter-spacing:normal;}
.rjs-btn--label-strong{font-weight:var(--font-weight-semibold);text-transform:none;letter-spacing:normal;}
.rjs-btn--label-chrome{font-weight:var(--font-weight-bold);text-transform:uppercase;font-size:var(--text-micro-size);letter-spacing:0.1em;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-button-css")) {
    const s = document.createElement("style");
    s.id = "rjs-button-css";
    s.textContent = css;
    document.head.appendChild(s);
}

const EMPHASIS_CLASS = {
    primary: "rjs-btn--primary",
    secondary: "rjs-btn--secondary-emphasis",
    tertiary: "rjs-btn--tertiary",
    danger: "rjs-btn--danger",
    link: "rjs-btn--link",
    info: "rjs-btn--info",
};

export function Button({
    variant,
    size,
    emphasis,
    density,
    shape,
    label,
    className = "",
    children,
    ...rest
}) {
    const classes = ["rjs-btn"];
    if (emphasis) classes.push(EMPHASIS_CLASS[emphasis] || EMPHASIS_CLASS.primary);
    else classes.push(`rjs-btn--${variant || "default"}`);
    if (density) classes.push(`rjs-btn--density-${density}`);
    else classes.push(`rjs-btn--size-${size || "default"}`);
    if (shape) classes.push(`rjs-btn--shape-${shape}`);
    if (label) classes.push(`rjs-btn--label-${label}`);
    if (className) classes.push(className);
    return (
        <button className={classes.join(" ")} {...rest}>
            {children}
        </button>
    );
}
