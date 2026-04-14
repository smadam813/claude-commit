import * as vscode from 'vscode';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'claudeCommit.generate',
    async (scm?: vscode.SourceControl) => {
      const repo = scm ?? getFirstGitRepo();
      if (!repo) {
        vscode.window.showErrorMessage('No git repository found.');
        return;
      }

      const cwd = repo.rootUri?.fsPath;
      if (!cwd) {
        vscode.window.showErrorMessage('Could not resolve repo path.');
        return;
      }

      const config = vscode.workspace.getConfiguration('claudeCommit');
      const model = config.get<string>('model', 'claude-haiku-4-5');
      const maxChars = config.get<number>('maxChars', 400);
      const claudePath = config.get<string>('claudePath', 'claude');

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.SourceControl,
          title: 'Generating commit message…',
        },
        async () => {
          try {
            // Get staged diff; fall back to unstaged if nothing staged
            let { stdout: diff } = await execAsync('git diff --staged', {
              cwd,
              maxBuffer: 10 * 1024 * 1024,
            });
            if (!diff.trim()) {
              ({ stdout: diff } = await execAsync('git diff', {
                cwd,
                maxBuffer: 10 * 1024 * 1024,
              }));
            }
            if (!diff.trim()) {
              vscode.window.showWarningMessage('No changes to summarize.');
              return;
            }

            const prompt = [
              'Diff:',
              '```diff',
              diff,
              '```',
              '',
              'Write a commit message following the Conventional Commits spec. Format:',
              '',
              'Subject line: <type>(<optional scope>): <imperative description>, max 72 characters, no period at the end. Types: feat, fix, docs, style, refactor, test, chore.',
              'If the change is non-trivial, add a blank line and a body explaining why the change was made (not what — the diff shows that). Wrap body at 72 chars. Bullet points are fine.',
              'The subject line must cover exactly ONE topic. If the diff contains unrelated changes, choose the single most significant change for the subject and list the others in the body. The word "and" must not appear in the subject line.',
              'Example of a multi-topic diff handled correctly:',
              '  feat: add retry logic to upload handler',
              '',
              '  - Also renames `maxTries` to `maxAttempts` for consistency',
              '  - Bumps axios to 1.7.2',
              'Example of what NOT to do: "feat: add retry logic and rename config keys" (two topics joined with "and" — forbidden).',
              'The body should answer "why was this change needed" — a constraint, a bug, a deprecation, a decision. Avoid generic phrases like "improves quality" or "enhances readability" that could apply to any diff.',
              `Keep total message under ${maxChars} characters.`,
              'Output ONLY the commit message as raw text — no code fences, no backticks, no preamble, no explanation.',
            ].join('\n');

            const stdout: string = await new Promise<string>((resolve, reject) => {
              const proc = spawn(claudePath, ['-p', '--model', model], { cwd });
              let out = '', err = '';
              proc.stdout.on('data', (d) => (out += d.toString()));
              proc.stderr.on('data', (d) => (err += d.toString()));
              proc.on('error', reject);
              proc.on('close', (code) =>
                code === 0 ? resolve(out) : reject(new Error(err || `exit ${code}`))
              );
              proc.stdin.write(prompt);
              proc.stdin.end();
            });

            let message = stripCodeFence(stdout.trim());
            if (message.length > maxChars) {
              message = message.slice(0, maxChars).trimEnd() + '…';
            }

            repo.inputBox.value = message;
          } catch (err: any) {
            vscode.window.showErrorMessage(
              `Claude commit failed: ${err.message ?? err}`
            );
          }
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

function getFirstGitRepo(): vscode.SourceControl | undefined {
  const gitExt = vscode.extensions.getExtension('vscode.git')?.exports;
  const api = gitExt?.getAPI(1);
  return api?.repositories?.[0];
}

function stripCodeFence(s: string): string {
  const match = s.match(/^```(?:[\w-]+)?\n([\s\S]*?)\n```$/);
  return match ? match[1].trim() : s;
}

export function deactivate() {}