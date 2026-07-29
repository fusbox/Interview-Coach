"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

const stages = [
    {
        id: "answer",
        label: "Your answer",
        title: "What you said",
        body: "I coordinated the weekend coverage plan, called in two float nurses, and kept the charge nurse looped in so no shift was left short.",
    },
    {
        id: "notice",
        label: "What I noticed",
        title: "Clear action + context",
        body: "You named the situation, the actions you took, and who you kept informed. That gives the interviewer a complete picture.",
    },
    {
        id: "next",
        label: "Try next",
        title: "Add one concrete result",
        body: "Close with what changed because of your actions — for example, every shift stayed staffed and patients stayed covered.",
    },
] as const;

export function CoachingPreview() {
    const [index, setIndex] = useState(0);
    const [reducedMotion, setReducedMotion] = useState(false);
    const stage = stages[index];

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => setReducedMotion(media.matches);
        sync();
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);

    useEffect(() => {
        if (reducedMotion) {
            return;
        }
        const timer = window.setInterval(() => {
            setIndex((current) => (current + 1) % stages.length);
        }, 4200);
        return () => window.clearInterval(timer);
    }, [reducedMotion]);

    return (
        <div className="marketing-preview" aria-label="Interactive coaching preview">
            <div className="marketing-preview__chrome">
                <span className="marketing-preview__dot" aria-hidden="true" />
                <span className="marketing-preview__dot" aria-hidden="true" />
                <span className="marketing-preview__dot" aria-hidden="true" />
                <p className="marketing-preview__path">Practice · Behavioral question</p>
            </div>

            <p className="marketing-preview__question">
                Tell me about a time you handled a staffing gap under pressure.
            </p>

            <div className="marketing-preview__stage" key={stage.id} data-stage={stage.id}>
                <p className="marketing-preview__stage-label">{stage.label}</p>
                <h3 className="marketing-preview__stage-title">{stage.title}</h3>
                <p className="marketing-preview__stage-body">{stage.body}</p>
            </div>

            <div className="marketing-preview__controls" role="tablist" aria-label="Preview stages">
                {stages.map((item, itemIndex) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={itemIndex === index}
                        className={
                            itemIndex === index
                                ? "marketing-preview__tab marketing-preview__tab--active"
                                : "marketing-preview__tab"
                        }
                        onClick={() => setIndex(itemIndex)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <button
                type="button"
                className="marketing-preview__advance"
                onClick={() => setIndex((current) => (current + 1) % stages.length)}
            >
                See next coaching step
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
}
