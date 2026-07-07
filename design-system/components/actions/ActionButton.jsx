import React from "react";

const css = `
.rjs-actionbtn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:9999px;font-family:var(--font-sans);font-weight:var(--font-weight-semibold);font-size:14px;cursor:pointer;text-decoration:none;transition:transform 200ms,background-color 200ms,opacity 200ms;border:1px solid transparent;}
.rjs-actionbtn--size-default{padding:12px 20px;}
.rjs-actionbtn--size-large{min-height:48px;padding:14px 24px;}
.rjs-actionbtn--primary{background:rgb(var(--candidate-primary));color:#fff;box-shadow:var(--candidate-shadow-cta);}
.rjs-actionbtn--primary:hover{background:rgb(9,81,199);}
.rjs-actionbtn--secondary{border-color:rgb(var(--candidate-border));background:rgb(var(--candidate-surface));color:rgb(var(--candidate-foreground));}
.rjs-actionbtn--secondary:hover{background:rgb(var(--candidate-background));}
.rjs-actionbtn:not(.rjs-actionbtn--disabled):hover{transform:translateY(-2px);}
.rjs-actionbtn--disabled{cursor:not-allowed;opacity:.5;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-actionbtn-css")) {
    const s = document.createElement("style");
    s.id = "rjs-actionbtn-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function ActionButton({
    href,
    secondary = false,
    size = "default",
    disabled = false,
    className = "",
    children,
    ...rest
}) {
    const classes = [
        "rjs-actionbtn",
        `rjs-actionbtn--size-${size}`,
        secondary ? "rjs-actionbtn--secondary" : "rjs-actionbtn--primary",
        disabled ? "rjs-actionbtn--disabled" : "",
        className,
    ].filter(Boolean).join(" ");

    if (href) {
        return (
            <a className={classes} href={disabled ? "#" : href} aria-disabled={disabled} {...rest}>
                {children}
            </a>
        );
    }
    return (
        <button className={classes} disabled={disabled} {...rest}>
            {children}
        </button>
    );
}
