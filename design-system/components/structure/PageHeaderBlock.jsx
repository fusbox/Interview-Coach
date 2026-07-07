import React from "react";
import { SectionHeader } from "./SectionHeader.jsx";

export function PageHeaderBlock({ eyebrow, title, description, actions, children, className = "", ...rest }) {
    return (
        <div
            className={className}
            style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24, borderBottom: "1px solid hsl(var(--border))", fontFamily: "var(--font-sans)" }}
            {...rest}
        >
            <SectionHeader eyebrow={eyebrow} title={title} description={description} actions={actions} size="lg" />
            {children}
        </div>
    );
}
