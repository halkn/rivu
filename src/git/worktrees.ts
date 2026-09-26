import type { Checkout } from "../work";

/** Parses `git worktree list --porcelain -z`. */
export function parseWorktreeList(out: string): Checkout[] {
  const checkouts: Checkout[] = [];
  let isFirst = true;
  for (const record of out.split("\0\0")) {
    const attrs = new Map<string, string>();
    for (const line of record.split("\0")) {
      if (!line) continue;
      const space = line.indexOf(" ");
      attrs.set(
        space === -1 ? line : line.slice(0, space),
        space === -1 ? "" : line.slice(space + 1),
      );
    }
    const path = attrs.get("worktree");
    if (path === undefined) continue;
    const isMain = isFirst;
    isFirst = false;
    if (attrs.has("bare")) continue;

    const oid = attrs.get("HEAD") ?? "";
    const branch = attrs.get("branch");
    checkouts.push({
      path,
      isMain,
      head:
        branch === undefined
          ? { kind: "detached", oid }
          : { kind: "branch", name: branch.replace(/^refs\/heads\//, ""), oid },
      locked: attrs.has("locked"),
      prunable: attrs.has("prunable"),
    });
  }
  return checkouts;
}
