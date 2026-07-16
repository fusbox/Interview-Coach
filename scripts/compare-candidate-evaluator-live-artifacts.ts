import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
    CandidateEvaluatorLiveValidationGuardError,
    createCandidateEvaluatorLiveComparison,
} from "../src/features/evaluation-v2/candidate-evaluator-live-validation";

void main();

async function main() {
    try {
        const options = parseArguments(process.argv.slice(2));
        const baseline = await readJson(options.baselinePath);
        const candidate = await readJson(options.candidatePath);
        const comparison = createCandidateEvaluatorLiveComparison({ baseline, candidate });
        const outputPath = resolve(options.outputPath ?? defaultOutputPath(comparison.generatedAt, comparison.comparisonId));
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, `${JSON.stringify(comparison, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

        process.stdout.write(`${JSON.stringify({
            artifact: outputPath,
            comparisonId: comparison.comparisonId,
            mode: comparison.mode,
            comparableCases: comparison.summary.comparableCases,
            totalCases: comparison.summary.totalCases,
            comparisonReady: comparison.summary.comparisonReady,
            flags: comparison.summary.flags,
            preference: comparison.summary.preference,
        }, null, 2)}\n`);
        if (!comparison.summary.comparisonReady) process.exitCode = 1;
    } catch (error) {
        const safeCode = error instanceof CandidateEvaluatorLiveValidationGuardError
            ? error.safeCode
            : "LIVE_EVALUATOR_COMPARISON_FAILED";
        process.stderr.write(`${safeCode}\n`);
        process.exitCode = 1;
    }
}

async function readJson(path: string) {
    try {
        return JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
    } catch {
        throw new CandidateEvaluatorLiveValidationGuardError("LIVE_EVALUATOR_ARTIFACT_READ_FAILED");
    }
}

function parseArguments(args: string[]) {
    let baselinePath: string | undefined;
    let candidatePath: string | undefined;
    let outputPath: string | undefined;

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--baseline" || argument === "--candidate" || argument === "--output") {
            const value = args[index + 1];
            if (!value || value.startsWith("--")) {
                throw new CandidateEvaluatorLiveValidationGuardError("LIVE_EVALUATOR_COMPARISON_PATH_REQUIRED");
            }
            if (argument === "--baseline") baselinePath = value;
            if (argument === "--candidate") candidatePath = value;
            if (argument === "--output") outputPath = value;
            index += 1;
            continue;
        }
        throw new CandidateEvaluatorLiveValidationGuardError("LIVE_EVALUATOR_UNKNOWN_ARGUMENT");
    }

    if (!baselinePath || !candidatePath) {
        throw new CandidateEvaluatorLiveValidationGuardError("LIVE_EVALUATOR_COMPARISON_INPUTS_REQUIRED");
    }
    return { baselinePath, candidatePath, outputPath };
}

function defaultOutputPath(generatedAt: string, comparisonId?: string) {
    const timestamp = generatedAt.replace(/[:.]/g, "-");
    return `AI-eval/candidate-v2/comparisons/live-comparison-${timestamp}${comparisonId ? `-${comparisonId}` : ""}.json`;
}
