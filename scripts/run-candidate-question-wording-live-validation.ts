import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { loadEnvConfig } from "@next/env";

import {
    CandidateQuestionWordingLiveValidationGuardError,
    runCandidateQuestionWordingLiveValidation,
} from "../src/features/candidate-session-v2/candidate-question-wording-live-validation";

loadEnvConfig(process.cwd());

void main();

async function main() {
    try {
        const options = parseArguments(process.argv.slice(2));
        const artifact = await runCandidateQuestionWordingLiveValidation({
            env: { ...process.env },
            confirmedLiveProvider: options.confirmedLiveProvider,
        });
        const outputPath = resolve(options.outputPath ?? defaultOutputPath(
            artifact.generatedAt,
            artifact.artifactId,
        ));
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, {
            encoding: "utf8",
            flag: "wx",
        });

        process.stdout.write(`${JSON.stringify({
            artifact: outputPath,
            artifactId: artifact.artifactId,
            profileId: artifact.profile.profileId,
            configurationFingerprint: artifact.profile.configurationFingerprint,
            outcome: artifact.result.outcome,
            transportAttemptCount: artifact.summary.transportAttemptCount,
            automatedGatePassed: artifact.summary.automatedGatePassed,
            humanQuestionReview: artifact.summary.humanQuestionReview,
        }, null, 2)}\n`);
        if (!artifact.summary.automatedGatePassed) process.exitCode = 1;
    } catch (error) {
        const safeCode = error instanceof CandidateQuestionWordingLiveValidationGuardError
            ? error.safeCode
            : "LIVE_QUESTION_WORDING_HARNESS_FAILED";
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
                throw new CandidateQuestionWordingLiveValidationGuardError("LIVE_QUESTION_WORDING_OUTPUT_PATH_REQUIRED");
            }
            index += 1;
            continue;
        }
        throw new CandidateQuestionWordingLiveValidationGuardError("LIVE_QUESTION_WORDING_UNKNOWN_ARGUMENT");
    }

    return { confirmedLiveProvider, outputPath };
}

function defaultOutputPath(generatedAt: string, artifactId: string) {
    const timestamp = generatedAt.replace(/[:.]/g, "-");
    return `AI-eval/candidate-v2/question-wording/live-question-wording-${timestamp}-${artifactId}.json`;
}
