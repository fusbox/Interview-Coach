import React from "react";

const css = `
@keyframes rjs-pulse{0%,100%{opacity:1;}50%{opacity:.5;}}
.rjs-skeleton{animation:rjs-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite;border-radius:var(--radius-md);background:hsl(var(--muted));}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-skeleton-css")) {
    const s = document.createElement("style");
    s.id = "rjs-skeleton-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function Skeleton({ className = "", ...rest }) {
    return <div className={["rjs-skeleton", className].filter(Boolean).join(" ")} {...rest} />;
}
