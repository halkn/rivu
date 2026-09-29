import type { LineStat } from "../work";
import { runGit } from "./run";

/** Parses `git diff --numstat -z`. Renames report the new path. */
export function parseNumstat(out: string): LineStat[] {
  const fields = out.split("\0");
  const stats: LineStat[] = [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (!field) continue;
    const [added = "", deleted = "", path = ""] = field.split("\t");
    let target = path;
    // A rename leaves the path empty and follows with the old and new paths as separate fields.
    if (target === "") {
      i += 2;
      target = fields[i] ?? "";
    }
    stats.push({
      path: target,
      added: added === "-" ? null : Number(added),
      deleted: deleted === "-" ? null : Number(deleted),
    });
  }
  return stats;
}

/** Parses `git ls-files -z`. */
export function parseLsFiles(out: string): string[] {
  return [...new Set(out.split("\0").filter(Boolean))].toSorted();
}

export async function listFiles(cwd: string): Promise<string[]> {
  return parseLsFiles(
    await runGit(cwd, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]),
  );
}

export async function loadLineStats(cwd: string): Promise<LineStat[]> {
  return parseNumstat(await runGit(cwd, ["diff", "--numstat", "-z", "HEAD"]));
}
