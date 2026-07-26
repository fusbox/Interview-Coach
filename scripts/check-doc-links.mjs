import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const docsRoot = resolve(root, "docs");
const includeArchive = process.argv.includes("--include-archive");
const rootMarkdownFiles = ["AGENTS.md", "CONTRIBUTING.md", "DECISION_LOG.md", "README.md"]
    .map((path) => resolve(root, path))
    .filter(existsSync);

function walk(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) {
            if (!includeArchive && path.startsWith(resolve(docsRoot, "reference-archive"))) {
                return [];
            }
            return walk(path);
        }
        return extname(entry.name).toLowerCase() === ".md" ? [path] : [];
    });
}

function normalizeTarget(rawTarget) {
    let target = rawTarget.trim();
    if (target.startsWith("<") && target.endsWith(">")) {
        target = target.slice(1, -1);
    }
    target = target.split(/\s+["']/u, 1)[0];
    target = target.split("#", 1)[0];
    try {
        return decodeURIComponent(target);
    } catch {
        return target;
    }
}

const failures = [];
for (const file of [...rootMarkdownFiles, ...walk(docsRoot)]) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/u);
    let inFence = false;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (/^\s*```/u.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;

        for (const match of line.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu)) {
            const target = normalizeTarget(match[1]);
            if (
                target.length === 0 ||
                target.startsWith("#") ||
                /^[a-z][a-z0-9+.-]*:/iu.test(target)
            ) {
                continue;
            }

            const resolved = /^\/[a-z]:\//iu.test(target)
                ? resolve(target.slice(1))
                : isAbsolute(target)
                    ? resolve(root, `.${target}`)
                    : resolve(dirname(file), target);

            if (!existsSync(resolved)) {
                failures.push({
                    file: file.slice(root.length + 1),
                    line: index + 1,
                    target,
                });
                continue;
            }

        }
    }
}

if (failures.length > 0) {
    for (const failure of failures) {
        process.stderr.write(`${failure.file}:${failure.line} -> ${failure.target}\n`);
    }
    process.stderr.write(`\n${failures.length} broken local documentation link(s).\n`);
    process.exitCode = 1;
} else {
    process.stdout.write("Documentation links are valid.\n");
}
