// Hands the terminal to Hunk for detailed diffs. See docs/design.md.
import type { CliRenderer } from "@opentui/core";

export function hunkArgs({ unborn, path }: { unborn: boolean; path?: string }): string[] {
  return ["diff", ...(unborn ? [] : ["HEAD"]), ...(path === undefined ? [] : ["--", path])];
}

/** Runs Hunk in the checkout while the TUI is suspended; returns a message when it cannot start. */
export function openInHunk(renderer: CliRenderer, cwd: string, args: string[]): string | null {
  renderer.suspend();
  try {
    Bun.spawnSync(["hunk", ...args], { cwd, stdio: ["inherit", "inherit", "inherit"] });
    return null;
  } catch {
    return "hunk is not installed";
  } finally {
    renderer.resume();
  }
}
