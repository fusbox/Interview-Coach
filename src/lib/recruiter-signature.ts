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
        name: name || "Recruiter",
        title: title || "Recruiter",
        company: company || "Rangam Consultants Inc.",
        phone: phone || "",
        email: email || "",
    };
}
