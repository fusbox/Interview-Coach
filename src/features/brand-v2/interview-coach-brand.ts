export const INTERVIEW_COACH_BRAND_ENV = "NEXT_PUBLIC_INTERVIEW_COACH_BRAND";

export type InterviewCoachBrandKey = "talentarbor" | "njcareers";

export type InterviewCoachBrand = Readonly<{
    key: InterviewCoachBrandKey;
    displayName: string;
    logoSrc: string;
    logoWidth: number;
    logoHeight: number;
}>;

const TALENTARBOR_BRAND = Object.freeze({
    key: "talentarbor",
    displayName: "TalentArbor",
    logoSrc: "/TA-logo.webp",
    logoWidth: 300,
    logoHeight: 70,
} satisfies InterviewCoachBrand);

const NJCAREERS_BRAND = Object.freeze({
    key: "njcareers",
    displayName: "NJ Career",
    logoSrc: "/njcareer-logo.png",
    logoWidth: 520,
    logoHeight: 120,
} satisfies InterviewCoachBrand);

export function resolveInterviewCoachBrand(rawValue: string | undefined): InterviewCoachBrand {
    return rawValue?.trim().toLowerCase() === "njcareers"
        ? NJCAREERS_BRAND
        : TALENTARBOR_BRAND;
}

export const interviewCoachBrand = resolveInterviewCoachBrand(
    process.env.NEXT_PUBLIC_INTERVIEW_COACH_BRAND,
);
