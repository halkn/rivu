export type GhErrorKind = "missing" | "unauthenticated" | "failed";

export class GhError extends Error {
  constructor(
    readonly kind: GhErrorKind,
    message: string,
  ) {
    super(message);
  }
}

// gh exits with 4 when the command requires authentication (`gh help exit-codes`).
const EXIT_AUTH_REQUIRED = 4;

export async function runGh(cwd: string, args: string[], bin = "gh"): Promise<string> {
  let proc;
  try {
    proc = Bun.spawn([bin, ...args], {
      cwd,
      // stdin is ignored so that gh can never wait for input while the TUI owns the terminal.
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, GH_PROMPT_DISABLED: "1", GH_NO_UPDATE_NOTIFIER: "1", NO_COLOR: "1" },
    });
  } catch {
    throw new GhError("missing", "gh is not installed");
  }
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode === 0) return stdout;
  if (exitCode === EXIT_AUTH_REQUIRED) {
    throw new GhError("unauthenticated", "gh is not authenticated (run `gh auth login`)");
  }
  const firstLine = stderr.trim().split("\n")[0] || `gh exited with ${exitCode}`;
  throw new GhError("failed", firstLine);
}
