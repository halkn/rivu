import type { Checkout, LocalState, Work } from "../work";
import { sanitize } from "./sanitize";

export function headLabel(checkout: Checkout): string {
  return checkout.head.kind === "branch"
    ? sanitize(checkout.head.name)
    : `(detached ${checkout.head.oid.slice(0, 7)})`;
}

export function changedFileCount(local: LocalState): number {
  return new Set([
    ...local.staged.map((change) => change.path),
    ...local.unstaged.map((change) => change.path),
    ...local.untracked,
    ...local.conflicted,
  ]).size;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function workSummary(work: Work): string {
  if (work.checkout.prunable) return "prunable (directory is missing)";
  if (work.local.status === "loading") return "loading…";
  if (work.local.status === "error") return `error: ${sanitize(work.local.message)}`;

  const local = work.local.value;
  const parts: string[] = [];
  const changed = changedFileCount(local);
  if (changed > 0) parts.push(`${plural(changed, "file")} changed`);
  if (local.conflicted.length > 0) parts.push(plural(local.conflicted.length, "conflict"));
  if (work.checkout.head.kind === "branch" && local.upstream === null) {
    parts.push("not pushed");
  } else if (local.aheadBehind && (local.aheadBehind.ahead > 0 || local.aheadBehind.behind > 0)) {
    parts.push(`↑${local.aheadBehind.ahead} ↓${local.aheadBehind.behind}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "clean";
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "always" });

export function relativeTime(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const [unit, size] = UNITS.find(([, unitSeconds]) => Math.abs(seconds) >= unitSeconds) ?? [
    "second",
    1,
  ];
  return relative.format(Math.round(seconds / size), unit);
}
