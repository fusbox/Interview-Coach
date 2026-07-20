import { describe, expect, it } from "vitest";

import { areCandidatePrototypeRoutesEnabled } from "./candidate-prototype-route";

describe("candidate prototype route boundary", () => {
    it("keeps prototypes available during local development", () => {
        expect(areCandidatePrototypeRoutesEnabled("development")).toBe(true);
        expect(areCandidatePrototypeRoutesEnabled("test")).toBe(true);
    });

    it("fails closed in production", () => {
        expect(areCandidatePrototypeRoutesEnabled("production")).toBe(false);
    });
});
