export const CANDIDATE_POLICY_LINKS = {
    terms: "https://talentarbor.com/terms-of-use",
    privacy: "https://talentarbor.com/privacy-policy",
    cookie: "https://talentarbor.com/cookie-policy",
    responsibleAi: "https://talentarbor.com/ResponsibleAIStatement",
} as const;

type PolicyEnv = Readonly<Record<string, string | undefined>>;

export type CandidatePolicyManifest = {
    termsVersion: string;
    privacyVersion: string;
    cookieVersion: string;
    responsibleAiVersion: string;
    contactAuthorizationVersion: string;
};

export function getCandidatePolicyManifest(
    env: PolicyEnv = process.env,
): CandidatePolicyManifest {
    return {
        termsVersion: readVersion(env, "CANDIDATE_TERMS_VERSION"),
        privacyVersion: readVersion(env, "CANDIDATE_PRIVACY_VERSION"),
        cookieVersion: readVersion(env, "CANDIDATE_COOKIE_VERSION"),
        responsibleAiVersion: readVersion(env, "CANDIDATE_RESPONSIBLE_AI_VERSION"),
        contactAuthorizationVersion: readVersion(env, "CANDIDATE_CONTACT_AUTHORIZATION_VERSION"),
    };
}

function readVersion(env: PolicyEnv, name: string): string {
    const value = env[name]?.trim();
    if (value) return value;
    if (env.NODE_ENV === "production") {
        throw new Error(`${name} is required for production candidate registration.`);
    }
    return "local-development-v1";
}
