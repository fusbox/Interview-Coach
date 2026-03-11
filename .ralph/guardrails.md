# Lessons Learned: Global Regex Replacement Failure

## Failure name
Catastrophic Truncation during Global Search-and-Replace

## Sign (how to detect early)
- `git status` or `git diff --stat` shows a massive number of deletions (thousands of lines) across many files.
- `npm run dev` or build commands fail with "Middleware must export a function" or similar "missing export" errors.
- Files become 0 bytes or significantly smaller.

## Root cause
Running a one-line Python script with `open(f, 'w')` within a list comprehension for global replacement. If any file in the loop fails to be read correctly (e.g., encoding issues) or the write fails, the file may be left truncated (0 bytes). Furthermore, list comprehensions for side effects (like file I/O) are dangerous and hard to debug.

## Fix applied
1. Immediate `git checkout src/` and `git checkout tailwind.config.ts` to restore all code.
2. Manual verification of key entry points (`layout.tsx`, `index.css`, `middleware.ts`).
3. Re-applying changes surgically using tested AI tools (`replace_file_content`) instead of raw shell/python scripts.

## Prevention rule
**NEVER** use broad shell-based or script-based global replacements (e.g., `sed`, `awk`, `python -c`) on the entire `src` directory. 
- ALWAYS use the provided `replace_file_content` or `multi_replace_file_content` tools for targeted edits.
- If a global change is absolutely necessary, perform it on a single file first, verify, then use a script that includes error handling and does NOT use the `open(f, 'w')` pattern without a confirmed successful read.
- ALWAYS run `git diff --stat` immediately after any multi-file automated change.
