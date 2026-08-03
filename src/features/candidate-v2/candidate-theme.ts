export const CANDIDATE_THEME_STORAGE_KEY = "interview-coach:theme";

export type CandidateTheme = "light" | "dark";

export function normalizeCandidateTheme(value: string | null | undefined): CandidateTheme {
    return value === "dark" ? "dark" : "light";
}
