import type {
  Checkout,
  LineStat,
  LocalState,
  PrState,
  PullRequest,
  ReviewState,
  Work,
} from "../work";
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

export type ChangeRow = {
  path: string;
  /** Two-letter staged/unstaged status as in `git status --short`. */
  status: string;
  added: number | null;
  deleted: number | null;
  binary: boolean;
};

export function changeRows(local: LocalState): ChangeRow[] {
  const status = new Map<string, [string, string]>();
  const set = (path: string, side: 0 | 1, code: string) => {
    const current = status.get(path) ?? [" ", " "];
    current[side] = code;
    status.set(path, current);
  };
  for (const change of local.staged) set(change.path, 0, change.code);
  for (const change of local.unstaged) set(change.path, 1, change.code);
  for (const path of local.untracked) status.set(path, ["?", "?"]);
  for (const path of local.conflicted) status.set(path, ["U", "U"]);
  const stats = new Map((local.lineStats ?? []).map((stat) => [stat.path, stat]));
  return [...status.entries()]
    .map(([path, [x, y]]) => {
      const stat = x === "U" ? undefined : stats.get(path);
      return {
        path,
        status: x + y,
        added: stat?.added ?? null,
        deleted: stat?.deleted ?? null,
        binary: stat !== undefined && stat.added === null,
      };
    })
    .toSorted((a, b) => a.path.localeCompare(b.path));
}

export function lineTotals(stats: LineStat[] | null): { added: number; deleted: number } | null {
  if (stats === null) return null;
  return stats.reduce(
    (total, stat) => ({
      added: total.added + (stat.added ?? 0),
      deleted: total.deleted + (stat.deleted ?? 0),
    }),
    { added: 0, deleted: 0 },
  );
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
  const totals = lineTotals(local.lineStats);
  if (totals && (totals.added > 0 || totals.deleted > 0)) {
    segments.push({ text: `+${totals.added} −${totals.deleted}`, tone: "warning" });
  }
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
  APPROVED: { text: "✓ Approved", tone: "success" },
  CHANGES_REQUESTED: { text: "✗ Changes requested", tone: "danger" },
  REVIEW_REQUIRED: { text: "○ Review required", tone: "warning" },
};

/** First PR line: which PR it is, or why there is none. */
export function prHeadline(pr: PrState): Segment[] {
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
  const headline: Segment[] = [
    { text: `#${value.number} ${sanitize(value.title)}`, tone: "accent" },
  ];
  if (value.state === "MERGED") headline.push({ text: "[merged]", tone: "muted" });
  else if (value.state === "CLOSED") headline.push({ text: "[closed]", tone: "muted" });
  else if (value.isDraft) headline.push({ text: "[draft]", tone: "muted" });
  return headline;
}

function checksSegment({ passed, failed, pending }: PullRequest["checks"]): Segment | undefined {
  const total = passed + failed + pending;
  if (total === 0) return undefined;
  if (failed > 0) return { text: `✗ CI ${failed}/${total} failed`, tone: "danger" };
  if (pending > 0) return { text: `○ CI ${passed}/${total}`, tone: "warning" };
  return { text: `✓ CI ${passed}/${total}`, tone: "success" };
}

function mergeSegment(pr: PullRequest): Segment | undefined {
  if (pr.mergeable === "CONFLICTING") return { text: "✗ Conflicts", tone: "danger" };
  switch (pr.mergeStateStatus) {
    case "BEHIND":
      return { text: "Behind base", tone: "warning" };
    case "BLOCKED":
      return { text: "Blocked", tone: "warning" };
    case "CLEAN":
    case "HAS_HOOKS":
    case "UNSTABLE":
      return { text: "Mergeable", tone: "success" };
    default:
      return undefined;
  }
}

/** Second PR line: CI, review and merge state of an open PR. */
export function prStatus(pr: PrState): Segment[] {
  if (pr.status !== "found" || pr.value.state !== "OPEN") return [];
  return [
    checksSegment(pr.value.checks),
    pr.value.reviewDecision ? REVIEW[pr.value.reviewDecision] : undefined,
    mergeSegment(pr.value),
  ].filter((segment) => segment !== undefined);
}

const REVIEW_VERBS: Record<ReviewState, string> = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "requested changes",
  COMMENTED: "commented",
  DISMISSED: "dismissed",
  PENDING: "pending",
};

export function reviewsText(reviews: PullRequest["latestReviews"]): string {
  if (reviews.length === 0) return "no reviews";
  return reviews
    .map((review) => `${sanitize(review.author)} ${REVIEW_VERBS[review.state]}`)
    .join(" · ");
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
