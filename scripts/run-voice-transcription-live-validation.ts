import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { loadEnvConfig } from "@next/env";

import {
    VoiceTranscriptionLiveValidationGuardError,
    VOICE_TRANSCRIPTION_LIVE_MIME_TYPES,
    runVoiceTranscriptionLiveValidation,
    type VoiceTranscriptionLiveMimeType,
} from "../src/features/interview-session-v2/voice-transcription-live-validation";

loadEnvConfig(process.cwd());

void main();

async function main() {
    try {
        const options = parseArguments(process.argv.slice(2));
        const audioData = new Uint8Array(await readFile(resolve(options.audioPath)));
        const artifact = await runVoiceTranscriptionLiveValidation({
            env: { ...process.env },
            confirmedLiveProvider: options.confirmedLiveProvider,
            audioData,
            mimeType: options.mimeType,
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
            humanTranscriptReview: artifact.summary.humanTranscriptReview,
        }, null, 2)}\n`);
        if (!artifact.summary.automatedGatePassed) process.exitCode = 1;
    } catch (error) {
        const safeCode = error instanceof VoiceTranscriptionLiveValidationGuardError
            ? error.safeCode
            : "LIVE_VOICE_TRANSCRIPTION_HARNESS_FAILED";
        process.stderr.write(`${safeCode}\n`);
        process.exitCode = 1;
    }
}

function parseArguments(args: string[]) {
    let confirmedLiveProvider = false;
    let audioPath: string | undefined;
    let mimeType: VoiceTranscriptionLiveMimeType | undefined;
    let outputPath: string | undefined;

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--confirm-live-provider") {
            confirmedLiveProvider = true;
            continue;
        }
        if (argument === "--audio") {
            audioPath = readArgumentValue(args, index, "LIVE_VOICE_TRANSCRIPTION_AUDIO_PATH_REQUIRED");
            index += 1;
            continue;
        }
        if (argument === "--mime-type") {
            const value = readArgumentValue(args, index, "LIVE_VOICE_TRANSCRIPTION_MIME_TYPE_REQUIRED");
            if (!isLiveMimeType(value)) {
                throw new VoiceTranscriptionLiveValidationGuardError("LIVE_VOICE_TRANSCRIPTION_MIME_TYPE_INVALID");
            }
            mimeType = value;
            index += 1;
            continue;
        }
        if (argument === "--output") {
            outputPath = readArgumentValue(args, index, "LIVE_VOICE_TRANSCRIPTION_OUTPUT_PATH_REQUIRED");
            index += 1;
            continue;
        }
        throw new VoiceTranscriptionLiveValidationGuardError("LIVE_VOICE_TRANSCRIPTION_UNKNOWN_ARGUMENT");
    }
    if (!audioPath) {
        throw new VoiceTranscriptionLiveValidationGuardError("LIVE_VOICE_TRANSCRIPTION_AUDIO_PATH_REQUIRED");
    }
    if (!mimeType) {
        throw new VoiceTranscriptionLiveValidationGuardError("LIVE_VOICE_TRANSCRIPTION_MIME_TYPE_REQUIRED");
    }
    return { confirmedLiveProvider, audioPath, mimeType, outputPath };
}

function isLiveMimeType(value: string): value is VoiceTranscriptionLiveMimeType {
    return (VOICE_TRANSCRIPTION_LIVE_MIME_TYPES as readonly string[]).includes(value);
}

function readArgumentValue(args: string[], index: number, safeCode: string) {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
        throw new VoiceTranscriptionLiveValidationGuardError(safeCode);
    }
    return value;
}

function defaultOutputPath(generatedAt: string, artifactId: string) {
    const timestamp = generatedAt.replace(/[:.]/g, "-");
    return `AI-eval/candidate-v2/voice-transcription/live-voice-transcription-${timestamp}-${artifactId}.json`;
}
