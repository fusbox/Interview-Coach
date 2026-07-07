import React from "react";

const css = `
.rjs-input{display:flex;height:40px;width:100%;border-radius:var(--radius-md);border:1px solid hsl(var(--input));background:hsl(var(--background));padding:8px 12px;font-size:14px;font-family:var(--font-sans);color:hsl(var(--text-primary));transition:all var(--duration-base) var(--ease-standard);box-sizing:border-box;}
.rjs-input::placeholder{color:hsl(var(--muted-foreground));}
.rjs-input:focus-visible{outline:2px solid hsl(var(--ring));outline-offset:2px;}
.rjs-input:disabled{cursor:not-allowed;opacity:.5;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-input-css")) {
    const s = document.createElement("style");
    s.id = "rjs-input-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function Input({ className = "", ...rest }) {
    return <input className={["rjs-input", className].filter(Boolean).join(" ")} {...rest} />;
}
