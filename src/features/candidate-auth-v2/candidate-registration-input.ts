export const CANDIDATE_EMAIL_MAX_LENGTH = 320;
export const CANDIDATE_EMAIL_INPUT_PATTERN = String.raw`[^\s@]+@[^\s@]+\.[^\s@]+`;
export const CANDIDATE_PHONE_INPUT_PATTERN = String.raw`(?:\([0-9]{3}\) [0-9]{3}-[0-9]{4}|\+[1-9][0-9]{7,14})`;

export function sanitizeCandidateEmailInput(value: string): string {
    return value.replace(/\s/g, "").slice(0, CANDIDATE_EMAIL_MAX_LENGTH);
}

export function formatCandidatePhoneInput(value: string): string {
    const international = value.trimStart().startsWith("+");
    let digits = value.replace(/\D/g, "");

    if (international) {
        return `+${digits.slice(0, 15)}`;
    }

    if (digits.length > 10 && digits.startsWith("1")) {
        digits = digits.slice(1);
    }
    digits = digits.slice(0, 10);

    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function sanitizeCandidatePostalCodeInput(value: string): string {
    return value.replace(/\D/g, "").slice(0, 5);
}
