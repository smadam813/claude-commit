# Claude Commit

A VS Code extension that generates conventional commit messages from your staged diff using the [Claude CLI](https://docs.claude.com/en/docs/claude-code/overview).

## Requirements

- VS Code `^1.85.0`
- [`claude` CLI](https://docs.claude.com/en/docs/claude-code/overview) installed and on your `PATH` (or configure an explicit path)
- A git repository open in the workspace

## Usage

1. Stage the changes you want to commit (`git add`).
2. Open the **Source Control** view.
3. Click the sparkle icon in the view's title bar (tooltip: *Generate Commit Message (Claude)*).
4. The generated message is written into the commit input box — review, edit, commit.

If nothing is staged, the extension falls back to the unstaged diff.

The command is also available from the Command Palette as **Generate Commit Message (Claude)**.

## Settings

| Setting | Default | Description |
|---|---|---|
| `claudeCommit.model` | `claude-haiku-4-5` | Claude model to use. Swap for `claude-sonnet-4-6` if you want more judgment at the cost of latency. |
| `claudeCommit.maxChars` | `400` | Hard cap on total message length. Longer output is truncated. |
| `claudeCommit.claudePath` | `claude` | Path to the `claude` binary. Set this if the CLI isn't on your `PATH`. |

## How it works

The extension runs `git diff --staged` (falling back to `git diff`), pipes the diff into `claude -p --model <model>` over stdin, and places the CLI's stdout into the SCM input box. Nothing is sent anywhere except through your local `claude` CLI.

## Development

```bash
npm install
npm run compile        # one-shot build to out/
npm run watch          # rebuild on change
npx vsce package       # produce .vsix for local install
```

Install the built `.vsix` via **Extensions → ... → Install from VSIX...**

## Tips

- One logical change per commit still produces the best messages — the extension reads what you stage, so `git add -p` pays off.
- If messages feel consistently off, try raising the model to Sonnet before tweaking the prompt.
