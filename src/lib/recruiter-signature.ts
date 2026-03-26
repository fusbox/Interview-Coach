import {
    DEFAULT_RECRUITER_COMPANY,
    DEFAULT_RECRUITER_NAME,
    DEFAULT_RECRUITER_TITLE,
} from "@/lib/config/recruiter-defaults";

export interface RecruiterSignatureInput {
    name?: string | null;
    title?: string | null;
    company?: string | null;
    phone?: string | null;
    email?: string | null;
}

export interface RecruiterSignature {
    name: string;
    title: string;
    company: string;
    phone: string;
    email: string;
}

export function normalizeRecruiterSignature(input: RecruiterSignatureInput): RecruiterSignature {
    const name = input.name?.trim();
    const title = input.title?.trim();
    const company = input.company?.trim();
    const phone = input.phone?.trim();
    const email = input.email?.trim();

    return {
        name: name || DEFAULT_RECRUITER_NAME,
        title: title || DEFAULT_RECRUITER_TITLE,
        company: company || DEFAULT_RECRUITER_COMPANY,
        phone: phone || "",
        email: email || "",
    };
}
