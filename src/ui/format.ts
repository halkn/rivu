import type { Checkout, LocalState, PrState, PullRequest, Work } from "../work";
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

export type Tone = "success" | "warning" | "danger" | "accent" | "muted";

export type Segment = { text: string; tone: Tone };

function join(segments: Segment[]): string {
  return segments.map((segment) => segment.text).join(" · ");
}

export function localSegments(work: Work): Segment[] {
  if (work.checkout.prunable) return [{ text: "prunable (directory is missing)", tone: "muted" }];
  if (work.local.status === "loading") return [{ text: "loading…", tone: "muted" }];
  if (work.local.status === "error") {
    return [{ text: `error: ${sanitize(work.local.message)}`, tone: "danger" }];
  }

  const local = work.local.value;
  const segments: Segment[] = [];
  const changed = changedFileCount(local);
  if (changed > 0) segments.push({ text: `${plural(changed, "file")} changed`, tone: "warning" });
  if (local.conflicted.length > 0) {
    segments.push({ text: plural(local.conflicted.length, "conflict"), tone: "danger" });
  }
  if (work.checkout.head.kind === "branch" && local.upstream === null) {
    segments.push({ text: "not pushed", tone: "accent" });
  } else if (local.aheadBehind && (local.aheadBehind.ahead > 0 || local.aheadBehind.behind > 0)) {
    segments.push({
      text: `↑${local.aheadBehind.ahead} ↓${local.aheadBehind.behind}`,
      tone: "accent",
    });
  }
  return segments.length > 0 ? segments : [{ text: "clean", tone: "success" }];
}

export function workSummary(work: Work): string {
  return join(localSegments(work));
}

const REVIEW: Record<NonNullable<PullRequest["reviewDecision"]>, Segment> = {
  APPROVED: { text: "Approved", tone: "success" },
  CHANGES_REQUESTED: { text: "Changes requested", tone: "danger" },
  REVIEW_REQUIRED: { text: "Review required", tone: "warning" },
};

export function prSegments(pr: PrState): Segment[] {
  switch (pr.status) {
    case "loading":
      return [{ text: "PR loading…", tone: "muted" }];
    case "none":
      return [{ text: "no PR", tone: "muted" }];
    case "unavailable":
      return [{ text: `PR unavailable: ${sanitize(pr.reason)}`, tone: "muted" }];
    case "error":
      return [{ text: `PR error: ${sanitize(pr.message)}`, tone: "danger" }];
    case "found":
      break;
  }
  const value = pr.value;
  const segments: Segment[] = [
    { text: `PR #${value.number}${value.isDraft ? " (draft)" : ""}`, tone: "accent" },
  ];
  if (value.state === "MERGED") return [...segments, { text: "Merged", tone: "muted" }];
  if (value.state === "CLOSED") return [...segments, { text: "Closed", tone: "muted" }];

  const { passed, failed, pending } = value.checks;
  if (failed > 0) segments.push({ text: "Checks failed", tone: "danger" });
  else if (pending > 0) segments.push({ text: "CI running", tone: "warning" });
  else if (passed > 0) segments.push({ text: "CI passed", tone: "success" });
  if (value.reviewDecision) segments.push(REVIEW[value.reviewDecision]);
  if (value.mergeable === "CONFLICTING") segments.push({ text: "Conflicts", tone: "danger" });
  else if (value.mergeStateStatus === "BEHIND")
    segments.push({ text: "Behind base", tone: "warning" });
  return segments;
}

export function prSummary(pr: PrState): string {
  return join(prSegments(pr));
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
