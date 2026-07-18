import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { loadEnvConfig } from "@next/env";

import {
    CandidateCoachUpdateLiveValidationGuardError,
    runCandidateCoachUpdateLiveValidation,
} from "../src/features/candidate-dashboard-v2/candidate-coach-update-live-validation";

loadEnvConfig(process.cwd());

void main();

async function main() {
    try {
        const options = parseArguments(process.argv.slice(2));
        const artifact = await runCandidateCoachUpdateLiveValidation({
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
            humanLanguageReview: artifact.summary.humanLanguageReview,
        }, null, 2)}\n`);
        if (!artifact.summary.automatedGatePassed) process.exitCode = 1;
    } catch (error) {
        const safeCode = error instanceof CandidateCoachUpdateLiveValidationGuardError
            ? error.safeCode
            : "LIVE_COACH_UPDATE_HARNESS_FAILED";
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
                throw new CandidateCoachUpdateLiveValidationGuardError(
                    "LIVE_COACH_UPDATE_OUTPUT_PATH_REQUIRED",
                );
            }
            index += 1;
            continue;
        }
        throw new CandidateCoachUpdateLiveValidationGuardError(
            "LIVE_COACH_UPDATE_UNKNOWN_ARGUMENT",
        );
    }

    return { confirmedLiveProvider, outputPath };
}

function defaultOutputPath(generatedAt: string, artifactId: string) {
    const timestamp = generatedAt.replace(/[:.]/g, "-");
    return `AI-eval/candidate-v2/coach-update/live-coach-update-${timestamp}-${artifactId}.json`;
}
