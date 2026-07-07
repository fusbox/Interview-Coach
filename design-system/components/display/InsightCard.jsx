import React from "react";

const css = `
.rjs-insightcard{border-radius:var(--radius-2xl);border:1px solid;padding:20px;font-family:var(--font-sans);box-sizing:border-box;}
.rjs-insightcard--positive{border-color:rgba(167,243,208,0.6);background:rgba(236,253,245,0.6);}
.rjs-insightcard--caution{border-color:rgba(254,205,211,0.6);background:rgba(255,241,242,0.6);}
.rjs-insightcard--highlight{border-color:rgba(233,213,255,0.6);background:rgba(250,245,255,0.5);}
.rjs-insightcard--neutral{border-color:hsl(var(--border)/0.6);background:hsl(var(--surface-subtle));}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-insightcard-css")) {
    const s = document.createElement("style");
    s.id = "rjs-insightcard-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function InsightCard({ tone = "neutral", className = "", ...rest }) {
    return <div className={["rjs-insightcard", `rjs-insightcard--${tone}`, className].filter(Boolean).join(" ")} {...rest} />;
}
