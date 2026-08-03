import { spawnSync } from "node:child_process";

const iterations = 20;
const command = process.platform === "win32" ? "cmd" : "npx";
const testFiles = [
    "src/features/candidate-session-v2/candidate-answer-history-repository.test.ts",
    "src/features/candidate-practice-v2/candidate-practice-intent-creation.test.ts",
];
const args = process.platform === "win32"
    ? ["/c", "npx", "vitest", "run", ...testFiles]
    : ["vitest", "run", ...testFiles];

for (let index = 0; index < iterations; index += 1) {
    const attempt = index + 1;
    console.log(`\n[stability] Iteration ${attempt}/${iterations}`);

    const result = spawnSync(command, args, {
        stdio: "inherit",
        shell: false
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

console.log(`\n[stability] Completed ${iterations}/${iterations} successful iterations.`);
