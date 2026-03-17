import { spawnSync } from "node:child_process";

const iterations = 20;
const command = process.platform === "win32" ? "cmd" : "npx";
const args = process.platform === "win32"
    ? ["/c", "npx", "vitest", "run", "src/features/session/hooks/useDomainSession.test.tsx", "src/lib/server/infrastructure/supabase-session-repository.test.ts"]
    : ["vitest", "run", "src/features/session/hooks/useDomainSession.test.tsx", "src/lib/server/infrastructure/supabase-session-repository.test.ts"];

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
