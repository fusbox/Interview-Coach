import { describe, expect, it } from "vitest";

import type {
    CriterionAppraisal,
    EvidenceExtractionOutput,
    UniversalCriterionId,
} from "./evidence-first-evaluator-contract";
import {
    compareQuestionPreparednessBands,
    deriveQuestionPreparedness,
} from "./question-preparedness";

const criterionIds: UniversalCriterionId[] = [
    "answer_focus",
    "organization",
    "evidence_specificity",
    "role_skill_signal",
    "impact_judgment_takeaway",
];

describe("deriveQuestionPreparedness", () => {
    it.each([
        [["emerging", "emerging", "clear", "clear", "clear"], "clear"],
        [["clear", "clear", "clear", "strong", "strong"], "clear"],
        [["clear", "clear", "strong", "strong", "strong"], "strong"],
        [["strong", "strong", "strong", "strong", "strong"], "strong"],
    ] as const)("maps the criterion mean for %j to %s", (bands, expected) => {
        expect(deriveQuestionPreparedness({
            answerUsability: usability("usable"),
            technicalAccuracy: { status: "not_assessed" },
            criteria: ratedCriteria([...bands]),
        })).toMatchObject({
            status: "rated",
            band: expected,
            constraints: [],
        });
    });

    it("excludes not-elicited criteria and caps one unavailable criterion at clear", () => {
        const withNotElicited = ratedCriteria(["strong", "strong", "strong", "strong", "strong"]);
        withNotElicited[4] = unratedCriterion(criterionIds[4], "not_elicited");
        expect(deriveQuestionPreparedness({
            answerUsability: usability("usable"),
            technicalAccuracy: { status: "not_assessed" },
            criteria: withNotElicited,
        })).toMatchObject({
            status: "rated",
            band: "strong",
            notElicitedCriterionCount: 1,
            unavailableCriterionCount: 0,
        });

        const withOneUnavailable = ratedCriteria(["strong", "strong", "strong", "strong", "strong"]);
        withOneUnavailable[4] = unratedCriterion(criterionIds[4], "insufficient_data");
        expect(deriveQuestionPreparedness({
            answerUsability: usability("usable"),
            technicalAccuracy: { status: "not_assessed" },
            criteria: withOneUnavailable,
        })).toMatchObject({
            status: "rated",
            band: "clear",
            constraints: ["availability_cap"],
        });
    });

    it("returns incomplete for two unavailable criteria or an unusable answer", () => {
        const criteria = ratedCriteria(["strong", "strong", "strong", "strong", "strong"]);
        criteria[3] = unratedCriterion(criterionIds[3], "insufficient_data");
        criteria[4] = unratedCriterion(criterionIds[4], "unscoreable");
        expect(deriveQuestionPreparedness({
            answerUsability: usability("usable"),
            technicalAccuracy: { status: "not_assessed" },
            criteria,
        })).toMatchObject({
            status: "incomplete",
            reason: "multiple_unavailable_criteria",
        });

        expect(deriveQuestionPreparedness({
            answerUsability: usability("off_topic"),
            technicalAccuracy: { status: "not_assessed" },
            criteria: ratedCriteria(["strong", "strong", "strong", "strong", "strong"]),
        })).toMatchObject({
            status: "incomplete",
            reason: "answer_not_usable",
        });
    });

    it("fails closed when the universal criterion set is partial", () => {
        expect(deriveQuestionPreparedness({
            answerUsability: usability("usable"),
            technicalAccuracy: { status: "not_assessed" },
            criteria: ratedCriteria(["strong", "strong", "strong", "strong", "strong"]).slice(0, 3),
        })).toMatchObject({
            status: "incomplete",
            reason: "criterion_set_incomplete",
        });
    });

    it("caps a trusted technical contradiction at emerging and leaves not-assessed neutral", () => {
        const criteria = ratedCriteria(["strong", "strong", "strong", "strong", "strong"]);
        expect(deriveQuestionPreparedness({
            answerUsability: usability("usable"),
            technicalAccuracy: { status: "contradicted" },
            criteria,
        })).toMatchObject({
            status: "rated",
            band: "emerging",
            constraints: ["technical_contradiction_cap"],
        });
        expect(deriveQuestionPreparedness({
            answerUsability: usability("usable"),
            technicalAccuracy: { status: "not_assessed" },
            criteria,
        })).toMatchObject({
            status: "rated",
            band: "strong",
            constraints: [],
        });
    });

    it("orders only the qualitative bands needed by highest-earned reads", () => {
        expect(compareQuestionPreparednessBands("strong", "clear")).toBeGreaterThan(0);
        expect(compareQuestionPreparednessBands("clear", "emerging")).toBeGreaterThan(0);
        expect(compareQuestionPreparednessBands("clear", "clear")).toBe(0);
    });
});

function ratedCriteria(bands: Array<"emerging" | "clear" | "strong">): CriterionAppraisal[] {
    return criterionIds.map((criterionId, index) => ({
        criterionId,
        applicability: "observed",
        band: bands[index],
        evidenceSpanIds: [],
        reasonCode: `fixture_${criterionId}`,
    }));
}

function unratedCriterion(
    criterionId: UniversalCriterionId,
    applicability: "not_elicited" | "insufficient_data" | "unscoreable",
): CriterionAppraisal {
    return {
        criterionId,
        applicability,
        evidenceSpanIds: [],
        reasonCode: `fixture_${applicability}`,
    };
}

function usability(
    status: EvidenceExtractionOutput["answerUsability"]["status"],
): EvidenceExtractionOutput["answerUsability"] {
    return { status, reasonCode: `fixture_${status}` };
}
