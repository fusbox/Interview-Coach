import React from "react";

const css = `
.rjs-fcb{display:flex;align-items:center;justify-content:center;border:2px solid hsl(var(--border));background:transparent;cursor:pointer;font-family:var(--font-sans);transition:all 300ms;color:hsl(var(--text-secondary));}
.rjs-fcb--emoji{height:56px;width:56px;border-radius:var(--radius-2xl);font-size:30px;}
.rjs-fcb--chip{gap:8px;border-radius:var(--radius-2xl);padding:16px 32px;font-weight:var(--font-weight-bold);font-size:14px;background:#fff;}
.rjs-fcb--compact{gap:8px;border-radius:var(--radius-xl);padding:8px 16px;font-size:14px;font-weight:var(--font-weight-bold);background:hsl(var(--surface-base));color:hsl(var(--text-primary));}
.rjs-fcb--emoji:hover{border-color:hsl(var(--primary)/0.3);transform:scale(1.05);}
.rjs-fcb--emoji.rjs-fcb--selected{background:#fff;border-color:hsl(var(--primary)/0.5);transform:scale(1.1);box-shadow:var(--shadow-raised-2);}
.rjs-fcb--chip.rjs-fcb--tone-success:hover{border-color:#86efac;color:#16a34a;}
.rjs-fcb--chip.rjs-fcb--tone-success.rjs-fcb--selected{border-color:#16a34a;background:#16a34a;color:#fff;transform:scale(1.05);box-shadow:var(--shadow-raised-2);}
.rjs-fcb--chip.rjs-fcb--tone-neutral:hover{border-color:#cbd5e1;color:#1e293b;}
.rjs-fcb--chip.rjs-fcb--tone-neutral.rjs-fcb--selected{border-color:#1e293b;background:#1e293b;color:#fff;transform:scale(1.05);box-shadow:var(--shadow-raised-2);}
.rjs-fcb--compact:hover{border-color:hsl(var(--primary)/0.3);}
.rjs-fcb--compact.rjs-fcb--selected{border-color:hsl(var(--primary));background:hsl(var(--primary));color:hsl(var(--primary-foreground));box-shadow:var(--shadow-raised-1);}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-fcb-css")) {
    const s = document.createElement("style");
    s.id = "rjs-fcb-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export const EMOJI_SCALE = [
    { val: 1, emoji: "🙁" },
    { val: 2, emoji: "😐" },
    { val: 3, emoji: "🙂" },
    { val: 4, emoji: "😊" },
    { val: 5, emoji: "🤩" },
];

export function FeedbackChoiceButton({
    kind = "compact",
    selected = false,
    tone = "primary",
    className = "",
    children,
    ...rest
}) {
    const classes = [
        "rjs-fcb",
        `rjs-fcb--${kind}`,
        `rjs-fcb--tone-${tone}`,
        selected ? "rjs-fcb--selected" : "",
        className,
    ].filter(Boolean).join(" ");
    return <button className={classes} {...rest}>{children}</button>;
}
