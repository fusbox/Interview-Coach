import React from "react";

const css = `
.rjs-contentcard{border:1px solid hsl(var(--border));background:hsl(var(--card));color:hsl(var(--card-foreground));font-family:var(--font-sans);box-sizing:border-box;}
.rjs-contentcard--default{border-radius:var(--radius-2xl);padding:24px;box-shadow:var(--shadow-raised-1);}
.rjs-contentcard--spacious{border-radius:var(--radius-3xl);padding:40px;box-shadow:var(--shadow-raised-2);}
.rjs-contentcard--hero{border-radius:2rem;padding:40px;box-shadow:var(--shadow-floating);}
.rjs-contentcard--center{text-align:center;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-contentcard-css")) {
    const s = document.createElement("style");
    s.id = "rjs-contentcard-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function ContentCard({ density = "default", align = "left", className = "", ...rest }) {
    const classes = [
        "rjs-contentcard",
        `rjs-contentcard--${density}`,
        align === "center" ? "rjs-contentcard--center" : "",
        className,
    ].filter(Boolean).join(" ");
    return <div className={classes} {...rest} />;
}
