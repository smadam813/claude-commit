import * as vscode from 'vscode';
import { exec } from 'child_process';
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
              'Write a conventional commit message for the following git diff.',
              `Keep it under ${maxChars} characters total.`,
              'Format: a short subject line (max 72 chars), then if needed a blank line and a brief body with 1-3 bullet points.',
              'Output ONLY the commit message — no preamble, no code fences, no explanation.',
              '',
              'Diff:',
              diff,
            ].join('\n');

            const { stdout } = await execAsync(
              `${shellQuote(claudePath)} -p --model ${shellQuote(model)}`,
              {
                cwd,
                input: prompt,
                maxBuffer: 1024 * 1024,
                // @ts-ignore - `input` is supported via the options bag in newer Node
              } as any
            );

            let message = stdout.trim();
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

function shellQuote(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}

export function deactivate() {}