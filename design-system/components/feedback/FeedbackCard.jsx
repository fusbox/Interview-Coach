import React, { useState } from "react";
import { FeedbackChoiceButton, EMOJI_SCALE } from "../forms/FeedbackChoiceButton.jsx";
import { FeedbackPill } from "./FeedbackPill.jsx";

const css = `
.rjs-feedbackcard{position:relative;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:24px;padding:24px;border-radius:2rem;border:1px solid #e9d5ff;background:#faf5ff;box-shadow:var(--shadow-raised-1);transition:box-shadow 500ms;font-family:var(--font-sans);box-sizing:border-box;}
.rjs-feedbackcard:hover{box-shadow:var(--shadow-raised-2);}
.rjs-feedbackcard__title{font-size:18px;font-weight:var(--font-weight-bold);color:#3b0764;margin:0;}
.rjs-feedbackcard__scale{position:relative;display:flex;gap:8px;}
.rjs-feedbackcard__labels{display:flex;justify-content:space-between;width:100%;padding:0 4px;font-size:10px;font-weight:var(--font-weight-bold);text-transform:uppercase;letter-spacing:0.1em;color:rgba(59,7,100,0.7);}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-feedbackcard-css")) {
    const s = document.createElement("style");
    s.id = "rjs-feedbackcard-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function FeedbackCard({
    title,
    scaleType = "emoji",
    successText = "",
    lowLabel,
    highLabel,
    onRate,
    className = "",
    ...rest
}) {
    const [rating, setRating] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleRate = (val) => {
        setRating(val);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1500);
        if (onRate) onRate(val);
    };

    return (
        <div className={["rjs-feedbackcard", className].filter(Boolean).join(" ")} {...rest}>
            <span className="rjs-feedbackcard__title">{title}</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div className="rjs-feedbackcard__scale">
                    {EMOJI_SCALE.map(({ val, emoji }) => (
                        <FeedbackChoiceButton
                            key={val}
                            kind="emoji"
                            selected={rating === val}
                            onClick={() => handleRate(val)}
                            title={`Rate ${val}/5`}
                            style={scaleType === "numeric" ? { fontSize: 20, fontWeight: "var(--font-weight-bold)", fontFamily: "var(--font-display)" } : undefined}
                        >
                            {scaleType === "emoji" ? emoji : val}
                        </FeedbackChoiceButton>
                    ))}
                    <FeedbackPill isVisible={showSuccess} text={successText} />
                </div>
                {(lowLabel || highLabel) ? (
                    <div className="rjs-feedbackcard__labels">
                        <span>{lowLabel}</span>
                        <span>{highLabel}</span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
