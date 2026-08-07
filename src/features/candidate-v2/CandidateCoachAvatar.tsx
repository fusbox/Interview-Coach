import Image from "next/image";

type CandidateCoachAvatarProps = {
    variant?: "calm" | "surface" | "cta";
    frame?: "none" | "surface";
    className?: string;
};

export function CandidateCoachAvatar({
    variant = "calm",
    frame = "none",
    className = "",
}: CandidateCoachAvatarProps) {
    const baseClassName = [
        "candidate-coach-avatar",
        frame === "surface" ? "candidate-coach-avatar--surface-frame" : "",
        className,
    ].filter(Boolean).join(" ");

    return (
        <span className={baseClassName} aria-hidden="true">
            <Image
                className="candidate-coach-avatar__light"
                src={`/coach-avatar-${variant}-light.svg`}
                alt=""
                width={32}
                height={32}
                unoptimized
            />
            <Image
                className="candidate-coach-avatar__dark"
                src={`/coach-avatar-${variant}-dark.svg`}
                alt=""
                width={32}
                height={32}
                unoptimized
            />
        </span>
    );
}
