# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A VS Code extension that generates commit messages by piping the git diff into the `claude` CLI. The entire extension is ~100 lines in `src/extension.ts`. There are no tests, no bundler, and no framework — just `tsc` → `out/`.

## Commands

```bash
npm install
npm run compile                          # tsc -p ./  (one-shot)
npm run watch                             # tsc -watch
npx tsc --noEmit                          # type-check only
npx vsce package --allow-missing-repository   # produce .vsix
```

Install the built `.vsix` via VS Code → Extensions → `...` → **Install from VSIX...**, then reload the window.

## Architecture

One command (`claudeCommit.generate`) registered in `activate()`. The flow:

1. Resolve the target repo — either the `SourceControl` arg passed by VS Code (when invoked from the SCM title menu) or the first repo from the `vscode.git` extension API.
2. Run `git diff --staged` via `execAsync`; if empty, fall back to `git diff`.
3. `spawn` the `claude` CLI with `-p --model <model>`, write the diff-containing prompt to `stdin`, collect `stdout` via a manually-typed `Promise<string>`.
4. Truncate to `maxChars` and assign to `repo.inputBox.value`.

The `Promise<string>` annotation on the spawn wrapper is load-bearing — without it, TS infers `Buffer` and `.trim()` breaks. Do not remove.

## Menu contribution gotcha

The sparkle icon lives in `scm/title`, **not** `scm/inputBox`. `scm/inputBox` is a proposed API (`contribSourceControlInputBoxMenu`) and will fail to register in a normally-installed extension. If you want the icon inline with the commit input instead of the SCM view title, that requires proposed-API opt-in and won't work for end users — don't switch back.

## Settings surface

Three user-facing settings, all in `package.json` under `contributes.configuration`:

- `claudeCommit.model` (default `claude-haiku-4-5`) — Haiku is the intentional default; the tradeoff against Sonnet (latency vs. judgment) has been considered.
- `claudeCommit.maxChars` (default `400`) — hard cap enforced client-side after CLI returns.
- `claudeCommit.claudePath` (default `claude`) — resolves via `PATH` unless overridden.

## tsconfig note

`compilerOptions.types` explicitly lists `["node", "vscode"]`. Removing this breaks type resolution for `child_process`/`util` in some VS Code TS server states even though `@types/node` is installed. Keep it explicit.
