import Image from "next/image";

import { interviewCoachBrand } from "./interview-coach-brand";

export function InterviewCoachBrandMark({
    className,
    decorative = false,
    priority = false,
}: {
    className: string;
    decorative?: boolean;
    priority?: boolean;
}) {
    return (
        <Image
            src={interviewCoachBrand.logoSrc}
            alt={decorative ? "" : interviewCoachBrand.displayName}
            width={interviewCoachBrand.logoWidth}
            height={interviewCoachBrand.logoHeight}
            className={className}
            data-brand={interviewCoachBrand.key}
            priority={priority}
            unoptimized
        />
    );
}
