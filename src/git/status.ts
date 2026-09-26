import type { LocalStatus } from "../work";

/** Parses `git status --porcelain=v2 --branch -z`. */
export function parseStatus(out: string): LocalStatus {
  const status: LocalStatus = {
    upstream: null,
    aheadBehind: null,
    staged: [],
    unstaged: [],
    untracked: [],
    conflicted: [],
  };
  const fields = out.split("\0");
  for (let i = 0; i < fields.length; i++) {
    const line = fields[i];
    if (!line) continue;
    if (line.startsWith("# ")) {
      applyHeader(status, line.slice(2));
    } else if (line.startsWith("1 ")) {
      addChange(status, line.slice(2), 7);
    } else if (line.startsWith("2 ")) {
      const origPath = fields[++i];
      addChange(status, line.slice(2), 8, origPath);
    } else if (line.startsWith("u ")) {
      status.conflicted.push(nthField(line.slice(2), 9));
    } else if (line.startsWith("? ")) {
      status.untracked.push(line.slice(2));
    }
  }
  return status;
}

function applyHeader(status: LocalStatus, header: string) {
  const [key, ...rest] = header.split(" ");
  const value = rest.join(" ");
  if (key === "branch.upstream") {
    status.upstream = value;
  } else if (key === "branch.ab") {
    const match = /^\+(\d+) -(\d+)$/.exec(value);
    if (match) status.aheadBehind = { ahead: Number(match[1]), behind: Number(match[2]) };
  }
}

// The path is the last field and may itself contain spaces, so it is everything after the fixed fields.
function nthField(line: string, fixedFields: number): string {
  let index = 0;
  for (let n = 0; n < fixedFields; n++) index = line.indexOf(" ", index) + 1;
  return line.slice(index);
}

function addChange(status: LocalStatus, entry: string, fixedFields: number, origPath?: string) {
  const [x = ".", y = "."] = entry;
  const path = nthField(entry, fixedFields);
  const change = (code: string) =>
    origPath === undefined ? { path, code } : { path, code, origPath };
  if (x !== ".") status.staged.push(change(x));
  if (y !== ".") status.unstaged.push(change(y));
}
