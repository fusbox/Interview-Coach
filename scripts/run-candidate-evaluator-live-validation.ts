import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { loadEnvConfig } from "@next/env";

import {
    CandidateEvaluatorLiveValidationGuardError,
    runCandidateEvaluatorLiveValidation,
} from "../src/features/evaluation-v2/candidate-evaluator-live-validation";

loadEnvConfig(process.cwd());

void main();

async function main() {
    try {
        const options = parseArguments(process.argv.slice(2));
        const artifact = await runCandidateEvaluatorLiveValidation({
            env: { ...process.env },
            confirmedLiveProvider: options.confirmedLiveProvider,
        });
        const outputPath = resolve(options.outputPath ?? defaultOutputPath(artifact.generatedAt, artifact.artifactId));
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

        process.stdout.write(`${JSON.stringify({
            artifact: outputPath,
            artifactId: artifact.artifactId,
            profileId: artifact.profile.profileId,
            configurationFingerprint: artifact.profile.configurationFingerprint,
            requestedCases: artifact.summary.requestedCases,
            acceptedCases: artifact.summary.acceptedCases,
            passedCases: artifact.summary.passedCases,
            gatePassed: artifact.summary.gatePassed,
        }, null, 2)}\n`);
        if (!artifact.summary.gatePassed) process.exitCode = 1;
    } catch (error) {
        const safeCode = error instanceof CandidateEvaluatorLiveValidationGuardError
            ? error.safeCode
            : "LIVE_EVALUATOR_HARNESS_FAILED";
        process.stderr.write(`${safeCode}\n`);
        process.exitCode = 1;
    }
}

function parseArguments(args: string[]) {
    let confirmedLiveProvider = false;
    let outputPath: string | undefined;

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--confirm-live-provider") {
            confirmedLiveProvider = true;
            continue;
        }
        if (argument === "--output") {
            outputPath = args[index + 1];
            if (!outputPath || outputPath.startsWith("--")) {
                throw new CandidateEvaluatorLiveValidationGuardError("LIVE_EVALUATOR_OUTPUT_PATH_REQUIRED");
            }
            index += 1;
            continue;
        }
        throw new CandidateEvaluatorLiveValidationGuardError("LIVE_EVALUATOR_UNKNOWN_ARGUMENT");
    }

    return { confirmedLiveProvider, outputPath };
}

function defaultOutputPath(generatedAt: string, artifactId?: string) {
    const timestamp = generatedAt.replace(/[:.]/g, "-");
    return `AI-eval/candidate-v2/live/live-evaluator-${timestamp}${artifactId ? `-${artifactId}` : ""}.json`;
}
