export type InterviewStage =
    | "not_sure"
    | "initial_screening"
    | "initial_interview"
    | "follow_up_final"
    | "practice_only";

export const INTERVIEW_STAGE_OPTIONS: ReadonlyArray<{
    value: InterviewStage;
    label: string;
    description: string;
}> = [
    {
        value: "not_sure",
        label: "Not sure yet",
        description: "Use a balanced round when you are not sure what kind of interview is coming.",
    },
    {
        value: "initial_screening",
        label: "First conversation or screening",
        description: "Prepare for interest, background, availability, fit, and a few role basics.",
    },
    {
        value: "initial_interview",
        label: "First interview",
        description: "Practice the main role questions you are likely to hear after screening.",
    },
    {
        value: "follow_up_final",
        label: "Follow-up or final interview",
        description: "Go deeper on role scenarios, decision-making, and examples from your experience.",
    },
    {
        value: "practice_only",
        label: "No interview scheduled",
        description: "Build confidence for this kind of role even before an interview is booked.",
    },
];

const interviewStageValues = new Set<InterviewStage>(INTERVIEW_STAGE_OPTIONS.map((option) => option.value));

export function normalizeInterviewStage(value: unknown): InterviewStage {
    return typeof value === "string" && interviewStageValues.has(value as InterviewStage)
        ? value as InterviewStage
        : "not_sure";
}

export function getInterviewStageLabel(value: InterviewStage | null | undefined): string {
    const interviewStage = normalizeInterviewStage(value);
    return INTERVIEW_STAGE_OPTIONS.find((option) => option.value === interviewStage)?.label ?? "Not sure yet";
}
