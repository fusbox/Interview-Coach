import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";

type BrowserFixture = {
    requestedMimeType: string;
    actualMimeType: string;
    bytes: number[];
};

void main();

async function main() {
    const options = parseArguments(process.argv.slice(2));
    const input = new Uint8Array(await readFile(resolve(options.inputPath)));
    if (!input.byteLength) throw new Error("The synthetic input WAV is empty.");

    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const fixtures = await page.evaluate(async ({ audioBytes, requestedMimeTypes }) => {
            const inputBytes = new Uint8Array(audioBytes);
            const decodeContext = new AudioContext();
            const decoded = await decodeContext.decodeAudioData(inputBytes.buffer.slice(0));
            const generated: BrowserFixture[] = [];

            for (const requestedMimeType of requestedMimeTypes) {
                if (!MediaRecorder.isTypeSupported(requestedMimeType)) continue;
                const context = new AudioContext();
                const destination = context.createMediaStreamDestination();
                const source = context.createBufferSource();
                source.buffer = decoded;
                source.connect(destination);
                const recorder = new MediaRecorder(destination.stream, { mimeType: requestedMimeType });
                const chunks: BlobPart[] = [];
                recorder.addEventListener("dataavailable", (event) => {
                    if (event.data.size) chunks.push(event.data);
                });
                const stopped = new Promise<void>((resolveStopped, rejectStopped) => {
                    recorder.addEventListener("stop", () => resolveStopped(), { once: true });
                    recorder.addEventListener("error", () => rejectStopped(new Error("MediaRecorder failed.")), {
                        once: true,
                    });
                });
                recorder.start(100);
                source.start();
                await new Promise<void>((resolveEnded) => {
                    source.addEventListener("ended", () => resolveEnded(), { once: true });
                });
                recorder.stop();
                await stopped;
                destination.stream.getTracks().forEach((track) => track.stop());
                await context.close();
                const blob = new Blob(chunks, { type: recorder.mimeType });
                generated.push({
                    requestedMimeType,
                    actualMimeType: recorder.mimeType,
                    bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
                });
            }
            await decodeContext.close();
            return generated;
        }, {
            audioBytes: Array.from(input),
            requestedMimeTypes: [
                "audio/webm;codecs=opus",
                "audio/mp4;codecs=mp4a.40.2",
            ],
        });

        await mkdir(resolve(options.outputDirectory), { recursive: true });
        const summary = [];
        for (const fixture of fixtures) {
            const extension = fixture.actualMimeType.startsWith("audio/mp4") ? "mp4" : "webm";
            const outputPath = resolve(options.outputDirectory, `voice-transcription-live.${extension}`);
            await writeFile(outputPath, new Uint8Array(fixture.bytes));
            summary.push({
                requestedMimeType: fixture.requestedMimeType,
                actualMimeType: fixture.actualMimeType,
                outputPath,
                byteCount: fixture.bytes.length,
            });
        }
        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
        if (summary.length !== 2) process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

function parseArguments(args: string[]) {
    let inputPath: string | undefined;
    let outputDirectory = ".untracked";
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--input") {
            inputPath = readValue(args, index);
            index += 1;
            continue;
        }
        if (argument === "--output-dir") {
            outputDirectory = readValue(args, index);
            index += 1;
            continue;
        }
        throw new Error(`Unknown argument: ${argument}`);
    }
    if (!inputPath) throw new Error("--input is required.");
    return { inputPath, outputDirectory };
}

function readValue(args: string[], index: number) {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${args[index]}.`);
    return value;
}
