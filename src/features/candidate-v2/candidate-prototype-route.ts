export function areCandidatePrototypeRoutesEnabled(
    nodeEnv = process.env.NODE_ENV,
) {
    return nodeEnv !== "production";
}
