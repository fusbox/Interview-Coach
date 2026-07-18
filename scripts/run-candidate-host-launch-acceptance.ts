import {
    CandidateHostLaunchAcceptanceInputError,
    CANDIDATE_HOST_LAUNCH_ACCEPTANCE_CASES,
    inspectCandidateHostLaunchAcceptance,
    isCandidateHostLaunchAcceptanceCase,
    type CandidateHostLaunchAcceptanceCase,
} from "../src/features/candidate-auth-v2/host-launch-live-acceptance";

const args = process.argv.slice(2);

void main();

async function main() {
    try {
        const options = parseArguments(args);
        let launchUrl = await readHiddenLaunchUrl();
        const report = await inspectCandidateHostLaunchAcceptance({
            caseId: options.caseId,
            launchUrl,
            allowLocalHttp: options.allowLocalHttp,
        });
        launchUrl = "";

        if (options.json) {
            process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        } else {
            printHumanReport(report);
        }

        process.exitCode = report.passed ? 0 : 1;
    } catch (error) {
        const code = error instanceof CandidateHostLaunchAcceptanceInputError
            ? error.code
            : error instanceof CliInputError
                ? error.code
                : "probe_failed";
        process.stderr.write(`Host launch acceptance did not run: ${code}.\n`);
        process.exitCode = 1;
    }
}

function parseArguments(values: string[]) {
    let caseId: CandidateHostLaunchAcceptanceCase | null = null;
    let allowLocalHttp = false;
    let json = false;

    for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        if (value === "--case") {
            const candidate = values[index + 1];
            if (!candidate || !isCandidateHostLaunchAcceptanceCase(candidate)) {
                throw new CliInputError("invalid_case");
            }
            caseId = candidate;
            index += 1;
        } else if (value === "--allow-local-http") {
            allowLocalHttp = true;
        } else if (value === "--json") {
            json = true;
        } else if (value === "--help") {
            printHelp();
            process.exit(0);
        } else {
            throw new CliInputError("unsupported_argument");
        }
    }

    if (!caseId) {
        throw new CliInputError("missing_case");
    }

    return { caseId, allowLocalHttp, json };
}

async function readHiddenLaunchUrl() {
    if (!process.stdin.isTTY) {
        return await readPipedInput();
    }

    process.stdout.write("Paste the single-use host launch URL (input hidden), then press Enter: ");
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();

    return await new Promise<string>((resolve, reject) => {
        let value = "";

        const cleanup = () => {
            process.stdin.off("data", onData);
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdout.write("\n");
        };
        const onData = (chunk: string) => {
            for (const character of chunk) {
                if (character === "\u0003") {
                    cleanup();
                    reject(new CliInputError("cancelled"));
                    return;
                }
                if (character === "\r" || character === "\n") {
                    cleanup();
                    resolve(value);
                    return;
                }
                if (character === "\u007f" || character === "\b") {
                    value = value.slice(0, -1);
                    continue;
                }
                if (value.length < 16_385) {
                    value += character;
                }
            }
        };

        process.stdin.on("data", onData);
    });
}

async function readPipedInput() {
    process.stdin.setEncoding("utf8");
    let value = "";
    for await (const chunk of process.stdin) {
        value += chunk;
        if (value.length > 16_384) break;
    }
    return value.trim();
}

function printHumanReport(report: Awaited<ReturnType<typeof inspectCandidateHostLaunchAcceptance>>) {
    process.stdout.write(`Case: ${report.caseId}\n`);
    process.stdout.write(`Result: ${report.passed ? "PASS" : "FAIL"}\n`);
    process.stdout.write(`First exchange: ${report.firstExchange.status ?? "network error"}, ${report.firstExchange.route}\n`);
    process.stdout.write(`Request id: ${report.firstExchange.requestId ?? "missing"}\n`);
    if (report.replayExchange) {
        process.stdout.write(`Replay: ${report.replayExchange.status ?? "network error"}, cookie=${report.replayExchange.sessionCookie.present ? "present" : "absent"}\n`);
        process.stdout.write(`Replay request id: ${report.replayExchange.requestId ?? "missing"}\n`);
    }
    if (report.requiresDiagnosticCorrelation) {
        process.stdout.write("Server diagnostic correlation: required\n");
    }
    if (report.failures.length > 0) {
        process.stdout.write(`Failures: ${report.failures.join(", ")}\n`);
    }
}

function printHelp() {
    process.stdout.write("Usage: npm run qa:candidate:host-launch -- --case <case> [--json] [--allow-local-http]\n");
    process.stdout.write(`Cases: ${CANDIDATE_HOST_LAUNCH_ACCEPTANCE_CASES.join(", ")}\n`);
    process.stdout.write("The launch URL is read from hidden standard input and is never accepted as an argument.\n");
}

class CliInputError extends Error {
    constructor(public readonly code: string) {
        super(code);
        this.name = "CliInputError";
    }
}
