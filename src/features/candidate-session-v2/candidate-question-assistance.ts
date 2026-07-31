import type { CandidateSetupResumeArtifactReference } from "@/features/candidate-setup-v2/candidate-setup-contract";

import {
    candidateQuestionPlanCategoryDetails,
    type CandidateQuestionPlanCategory,
} from "./candidate-question-plan";

export const CANDIDATE_QUESTION_ASSISTANCE_KINDS = [
    "hints",
    "strong_response",
] as const;

export type CandidateQuestionAssistanceKind =
    typeof CANDIDATE_QUESTION_ASSISTANCE_KINDS[number];

export type CandidateQuestionHints = {
    status: "candidate_question_hints_v1";
    doThis: string;
    avoidThis: string;
};

export type CandidateStrongResponse = {
    status: "candidate_strong_response_v1";
    strongResponse: string;
    whyThisWorks: string;
};

export type CandidateQuestionAssistanceOutput =
    | CandidateQuestionHints
    | CandidateStrongResponse;

export function parseCandidateQuestionAssistanceOutput(
    value: unknown,
): CandidateQuestionAssistanceOutput | null {
    if (!isObject(value)) {
        return null;
    }
    if (
        value.status === "candidate_question_hints_v1"
        && hasExactKeys(value, ["status", "doThis", "avoidThis"])
        && isBoundedText(value.doThis, 10, 500)
        && isBoundedText(value.avoidThis, 10, 500)
    ) {
        return {
            status: value.status,
            doThis: value.doThis.trim(),
            avoidThis: value.avoidThis.trim(),
        };
    }
    if (
        value.status === "candidate_strong_response_v1"
        && hasExactKeys(value, ["status", "strongResponse", "whyThisWorks"])
        && isBoundedText(value.strongResponse, 40, 2_400)
        && isBoundedText(value.whyThisWorks, 20, 800)
    ) {
        return {
            status: value.status,
            strongResponse: value.strongResponse.trim(),
            whyThisWorks: value.whyThisWorks.trim(),
        };
    }
    return null;
}

export const CANDIDATE_QUESTION_EVIDENCE_FOCUS_IDS = [
    "answer_first",
    "brief_context",
    "personal_action",
    "observable_result",
    "reasoning",
    "tradeoff",
    "role_connection",
    "practical_application",
    "verification_or_escalation",
] as const;

export type CandidateQuestionEvidenceFocusId = typeof CANDIDATE_QUESTION_EVIDENCE_FOCUS_IDS[number];

export type CandidateQuestionAssistancePlan = {
    evidenceFocus: CandidateQuestionEvidenceFocusId[];
    resumeAnchorId: string | null;
};

export type CandidateQuestionResumeAnchor = {
    id: string;
    text: string;
};

export type CandidateQuestionAssistance = {
    status: "candidate_question_assistance_v1";
    evidenceFocus: CandidateQuestionEvidenceFocusId[];
    hints: [string, string] | [string, string, string];
    responseStructure: [string, string, string];
    exampleFramework: string;
    acceptedResumeAnchor: {
        id: string;
        text: string;
        cue: string;
    } | null;
};

export type HydratedCandidateQuestionAssistance = {
    assistance: CandidateQuestionAssistance;
    contentFingerprint: string;
};

const MAX_RESUME_ANCHORS = 8;
const MAX_RESUME_ANCHOR_LENGTH = 240;
const MIN_RESUME_ANCHOR_LENGTH = 20;
const RESUME_CUE_PREFIX = "Use this accepted resume detail if it helps: ";

const evidenceFocusCompatibility: Record<
    CandidateQuestionPlanCategory,
    readonly CandidateQuestionEvidenceFocusId[]
> = {
    screening: [
        "answer_first",
        "brief_context",
        "observable_result",
        "role_connection",
    ],
    behavioral: [
        "brief_context",
        "personal_action",
        "observable_result",
        "reasoning",
        "role_connection",
    ],
    culture_fit: [
        "answer_first",
        "brief_context",
        "personal_action",
        "role_connection",
    ],
    case_scenario: [
        "answer_first",
        "reasoning",
        "tradeoff",
        "practical_application",
        "verification_or_escalation",
    ],
    technical_role_specific: [
        "brief_context",
        "personal_action",
        "reasoning",
        "tradeoff",
        "practical_application",
        "verification_or_escalation",
    ],
};

const evidenceFocusHints: Record<CandidateQuestionEvidenceFocusId, string> = {
    answer_first: "Start with your main answer before adding detail.",
    brief_context: "Give only enough context to make the example easy to follow.",
    personal_action: "Make your own actions and decisions clear.",
    observable_result: "Include a result, change, or lesson the interviewer can understand.",
    reasoning: "Explain why you chose that approach.",
    tradeoff: "Name the tradeoff or constraint that shaped your choice.",
    role_connection: "Connect the answer to what matters in the role.",
    practical_application: "Show how you applied the tool, process, or judgment in practice.",
    verification_or_escalation: "Explain how you verified the work, handled limits, or escalated when needed.",
};

const exampleFrameworks: Record<CandidateQuestionPlanCategory, string> = {
    screening: "My main answer is [direct answer]. A relevant detail is [specific background or interest]. This connects to the role because [role connection].",
    behavioral: "In [brief situation], I was responsible for [your responsibility]. I [personal action], which led to [observable result or lesson].",
    culture_fit: "I do my best work when [work condition or value]. For example, [brief work example]. That matters here because [role connection].",
    case_scenario: "First, I would [initial action] because [reasoning]. Then I would [next action], while checking [constraint or tradeoff]. I would confirm success by [verification].",
    technical_role_specific: "I have used or would apply [tool, process, or judgment] by [practical application]. My reasoning would be [reasoning]. I would verify the result or escalate a limit by [verification or escalation].",
};

const fixtureEvidenceFocus: Record<
    CandidateQuestionPlanCategory,
    CandidateQuestionEvidenceFocusId[]
> = {
    screening: ["answer_first", "role_connection"],
    behavioral: ["brief_context", "personal_action", "observable_result"],
    culture_fit: ["answer_first", "brief_context", "role_connection"],
    case_scenario: ["answer_first", "reasoning", "tradeoff"],
    technical_role_specific: ["practical_application", "reasoning", "verification_or_escalation"],
};

export function getCandidateQuestionEvidenceFocusCompatibility(
    category: CandidateQuestionPlanCategory,
) {
    return evidenceFocusCompatibility[category];
}

export function createCandidateQuestionResumeAnchors({
    resumeText,
    resumeArtifact,
}: {
    resumeText: string | null;
    resumeArtifact?: CandidateSetupResumeArtifactReference | null;
}): CandidateQuestionResumeAnchor[] {
    if (!resumeText || resumeArtifact?.reviewState !== "accepted") {
        return [];
    }

    const candidates = resumeText.match(/[^\r\n.!?]+(?:[.!?]+|$)/g) ?? [];
    const seen = new Set<string>();
    const anchors: CandidateQuestionResumeAnchor[] = [];

    for (const candidate of candidates) {
        const text = boundResumeAnchor(candidate.trim().replace(/^[-*]\s+/, ""));
        const normalized = normalizeText(text);
        if (text.length < MIN_RESUME_ANCHOR_LENGTH || seen.has(normalized)) {
            continue;
        }

        seen.add(normalized);
        anchors.push({
            id: `resume_anchor_${sha256(text).slice(0, 16)}`,
            text,
        });
        if (anchors.length === MAX_RESUME_ANCHORS) {
            break;
        }
    }

    return anchors;
}

export function createDefaultCandidateQuestionAssistancePlan({
    category,
    resumeAnchors,
    questionIndex,
}: {
    category: CandidateQuestionPlanCategory;
    resumeAnchors: CandidateQuestionResumeAnchor[];
    questionIndex: number;
}): CandidateQuestionAssistancePlan {
    return {
        evidenceFocus: [...fixtureEvidenceFocus[category]],
        resumeAnchorId: resumeAnchors.length > 0
            ? resumeAnchors[questionIndex % resumeAnchors.length].id
            : null,
    };
}

export function createFixtureCandidateQuestionAssistancePlan(
    input: Parameters<typeof createDefaultCandidateQuestionAssistancePlan>[0],
) {
    return createDefaultCandidateQuestionAssistancePlan(input);
}

export function hydrateCandidateQuestionAssistance({
    category,
    questionText,
    assistancePlan,
    resumeAnchors,
}: {
    category: CandidateQuestionPlanCategory;
    questionText: string;
    assistancePlan: CandidateQuestionAssistancePlan;
    resumeAnchors: CandidateQuestionResumeAnchor[];
}): HydratedCandidateQuestionAssistance {
    assertAssistancePlan(category, assistancePlan, resumeAnchors);

    const selectedAnchor = assistancePlan.resumeAnchorId
        ? resumeAnchors.find((anchor) => anchor.id === assistancePlan.resumeAnchorId) ?? null
        : null;
    const hints = assistancePlan.evidenceFocus
        .slice(0, 3)
        .map((focus) => evidenceFocusHints[focus]) as CandidateQuestionAssistance["hints"];
    const responseStructure = candidateQuestionPlanCategoryDetails[category]
        .answerShape.slice(0, 3) as CandidateQuestionAssistance["responseStructure"];
    const assistance: CandidateQuestionAssistance = {
        status: "candidate_question_assistance_v1",
        evidenceFocus: [...assistancePlan.evidenceFocus],
        hints,
        responseStructure,
        exampleFramework: exampleFrameworks[category],
        acceptedResumeAnchor: selectedAnchor
            ? {
                ...selectedAnchor,
                cue: `${RESUME_CUE_PREFIX}${selectedAnchor.text}`,
            }
            : null,
    };

    return {
        assistance,
        contentFingerprint: createCandidateQuestionContentFingerprint({
            category,
            questionText,
            assistance,
        }),
    };
}

export function parseCandidateQuestionAssistance({
    value,
    category,
    questionText,
    contentFingerprint,
}: {
    value: unknown;
    category: CandidateQuestionPlanCategory;
    questionText: string;
    contentFingerprint: unknown;
}): HydratedCandidateQuestionAssistance | null {
    if (!isObject(value) || value.status !== "candidate_question_assistance_v1") {
        return null;
    }
    if (!hasExactKeys(value, [
        "status",
        "evidenceFocus",
        "hints",
        "responseStructure",
        "exampleFramework",
        "acceptedResumeAnchor",
    ])) {
        return null;
    }

    const evidenceFocus = readEvidenceFocus(value.evidenceFocus);
    const acceptedResumeAnchor = readAcceptedResumeAnchor(value.acceptedResumeAnchor);
    if (!evidenceFocus || acceptedResumeAnchor === undefined) {
        return null;
    }

    try {
        const expected = hydrateCandidateQuestionAssistance({
            category,
            questionText,
            assistancePlan: {
                evidenceFocus,
                resumeAnchorId: acceptedResumeAnchor?.id ?? null,
            },
            resumeAnchors: acceptedResumeAnchor
                ? [{ id: acceptedResumeAnchor.id, text: acceptedResumeAnchor.text }]
                : [],
        });
        if (
            !readSha256(contentFingerprint)
            || contentFingerprint !== expected.contentFingerprint
            || JSON.stringify(value) !== JSON.stringify(expected.assistance)
        ) {
            return null;
        }
        return expected;
    } catch {
        return null;
    }
}

export function createCandidateQuestionContentFingerprint({
    category,
    questionText,
    assistance,
}: {
    category: CandidateQuestionPlanCategory;
    questionText: string;
    assistance: CandidateQuestionAssistance;
}) {
    return sha256(JSON.stringify({
        category,
        questionText,
        assistance,
    }));
}

function assertAssistancePlan(
    category: CandidateQuestionPlanCategory,
    plan: CandidateQuestionAssistancePlan,
    resumeAnchors: CandidateQuestionResumeAnchor[],
) {
    const evidenceFocus = readEvidenceFocus(plan.evidenceFocus);
    const allowed = new Set(evidenceFocusCompatibility[category]);
    if (
        !evidenceFocus
        || evidenceFocus.some((focus) => !allowed.has(focus))
        || (
            plan.resumeAnchorId !== null
            && !resumeAnchors.some((anchor) => anchor.id === plan.resumeAnchorId)
        )
    ) {
        throw new Error("Invalid candidate question assistance.");
    }
}

function readEvidenceFocus(value: unknown): CandidateQuestionEvidenceFocusId[] | null {
    if (!Array.isArray(value) || value.length < 2 || value.length > 4) {
        return null;
    }
    const allowed = new Set<string>(CANDIDATE_QUESTION_EVIDENCE_FOCUS_IDS);
    if (
        value.some((focus) => typeof focus !== "string" || !allowed.has(focus))
        || new Set(value).size !== value.length
    ) {
        return null;
    }
    return value as CandidateQuestionEvidenceFocusId[];
}

function readAcceptedResumeAnchor(
    value: unknown,
): CandidateQuestionAssistance["acceptedResumeAnchor"] | undefined {
    if (value === null) {
        return null;
    }
    if (!isObject(value) || !hasExactKeys(value, ["id", "text", "cue"])) {
        return undefined;
    }
    const id = typeof value.id === "string" && /^resume_anchor_[a-f0-9]{16}$/.test(value.id)
        ? value.id
        : null;
    const text = typeof value.text === "string" ? value.text : "";
    const cue = typeof value.cue === "string" ? value.cue : "";
    if (
        !id
        || text.length < MIN_RESUME_ANCHOR_LENGTH
        || text.length > MAX_RESUME_ANCHOR_LENGTH
        || cue !== `${RESUME_CUE_PREFIX}${text}`
    ) {
        return undefined;
    }
    return { id, text, cue };
}

function boundResumeAnchor(value: string) {
    if (value.length <= MAX_RESUME_ANCHOR_LENGTH) {
        return value;
    }
    const bounded = value.slice(0, MAX_RESUME_ANCHOR_LENGTH);
    const lastWhitespace = bounded.lastIndexOf(" ");
    return (lastWhitespace >= MIN_RESUME_ANCHOR_LENGTH
        ? bounded.slice(0, lastWhitespace)
        : bounded).trim();
}

function normalizeText(value: string) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function readSha256(value: unknown) {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]) {
    return Object.keys(value).sort().join("|") === [...expected].sort().join("|");
}

function isBoundedText(value: unknown, min: number, max: number): value is string {
    return typeof value === "string"
        && value.trim().length >= min
        && value.trim().length <= max;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sha256(value: string) {
    const constants = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    const bytes = Array.from(new TextEncoder().encode(value));
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let shift = 56; shift >= 0; shift -= 8) {
        bytes.push(Math.floor(bitLength / (2 ** shift)) & 0xff);
    }

    const hash = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    const words = new Array<number>(64);
    for (let offset = 0; offset < bytes.length; offset += 64) {
        for (let index = 0; index < 16; index += 1) {
            const byteIndex = offset + (index * 4);
            words[index] = (
                (bytes[byteIndex] << 24)
                | (bytes[byteIndex + 1] << 16)
                | (bytes[byteIndex + 2] << 8)
                | bytes[byteIndex + 3]
            );
        }
        for (let index = 16; index < 64; index += 1) {
            const first = words[index - 15];
            const second = words[index - 2];
            const sigma0 = rotateRight(first, 7) ^ rotateRight(first, 18) ^ (first >>> 3);
            const sigma1 = rotateRight(second, 17) ^ rotateRight(second, 19) ^ (second >>> 10);
            words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) | 0;
        }

        let [a, b, c, d, e, f, g, h] = hash;
        for (let index = 0; index < 64; index += 1) {
            const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
            const choice = (e & f) ^ (~e & g);
            const temp1 = (h + sum1 + choice + constants[index] + words[index]) | 0;
            const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
            const majority = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (sum0 + majority) | 0;
            h = g;
            g = f;
            f = e;
            e = (d + temp1) | 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) | 0;
        }
        hash[0] = (hash[0] + a) | 0;
        hash[1] = (hash[1] + b) | 0;
        hash[2] = (hash[2] + c) | 0;
        hash[3] = (hash[3] + d) | 0;
        hash[4] = (hash[4] + e) | 0;
        hash[5] = (hash[5] + f) | 0;
        hash[6] = (hash[6] + g) | 0;
        hash[7] = (hash[7] + h) | 0;
    }
    return hash.map((part) => (part >>> 0).toString(16).padStart(8, "0")).join("");
}

function rotateRight(value: number, shift: number) {
    return (value >>> shift) | (value << (32 - shift));
}
