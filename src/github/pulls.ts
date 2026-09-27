import type { Checkout, PullRequest } from "../work";

export type PullListItem = {
  number: number;
  headRefName: string;
  isCrossRepository: boolean;
  state: PullRequest["state"];
};

class PullParseError extends Error {}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value))
    return value as T;
  throw new PullParseError(`unexpected ${field}: ${JSON.stringify(value)}`);
}

function string(value: unknown, field: string): string {
  if (typeof value === "string") return value;
  throw new PullParseError(`unexpected ${field}: ${JSON.stringify(value)}`);
}

function date(value: unknown, field: string): Date {
  const parsed = new Date(string(value, field));
  if (Number.isNaN(parsed.getTime()))
    throw new PullParseError(`unexpected ${field}: ${String(value)}`);
  return parsed;
}

function number(value: unknown, field: string): number {
  if (typeof value === "number") return value;
  throw new PullParseError(`unexpected ${field}: ${JSON.stringify(value)}`);
}

const STATES = ["OPEN", "MERGED", "CLOSED"] as const;

/** Parses `gh pr list --json number,headRefName,isCrossRepository,state`. */
export function parsePullList(json: string): PullListItem[] {
  const items: unknown = JSON.parse(json);
  if (!Array.isArray(items)) throw new PullParseError("expected a JSON array of pull requests");
  return items.map((item: Record<string, unknown>) => ({
    number: number(item.number, "number"),
    headRefName: string(item.headRefName, "headRefName"),
    isCrossRepository: item.isCrossRepository === true,
    state: oneOf(item.state, STATES, "state"),
  }));
}

/** `gh pr list` returns the newest first, so the first match is the newest. */
export function findPull(pulls: PullListItem[], branch: string): PullListItem | undefined {
  const candidates = pulls.filter((pull) => pull.headRefName === branch && !pull.isCrossRepository);
  return candidates.find((pull) => pull.state === "OPEN") ?? candidates[0];
}

export function pullBranchName(checkout: Checkout, upstream: string | null): string | null {
  if (checkout.head.kind !== "branch") return null;
  if (upstream === null) return checkout.head.name;
  const slash = upstream.indexOf("/");
  return slash === -1 ? upstream : upstream.slice(slash + 1);
}

const FAILED_CONCLUSIONS = new Set([
  "FAILURE",
  "TIMED_OUT",
  "CANCELLED",
  "ACTION_REQUIRED",
  "STARTUP_FAILURE",
]);

function summarizeChecks(rollup: unknown): PullRequest["checks"] {
  const checks = { passed: 0, failed: 0, pending: 0 };
  if (!Array.isArray(rollup)) return checks;
  for (const check of rollup as Record<string, unknown>[]) {
    if (check.__typename === "CheckRun") {
      if (check.status !== "COMPLETED") checks.pending++;
      else if (check.conclusion === "SUCCESS") checks.passed++;
      else if (FAILED_CONCLUSIONS.has(String(check.conclusion))) checks.failed++;
    } else if (check.__typename === "StatusContext") {
      if (check.state === "SUCCESS") checks.passed++;
      else if (check.state === "FAILURE" || check.state === "ERROR") checks.failed++;
      else if (check.state === "PENDING" || check.state === "EXPECTED") checks.pending++;
    }
  }
  return checks;
}

/** Parses `gh pr view --json` with the fields listed in docs/design.md. */
export function parsePullDetail(json: string): PullRequest {
  const pr = JSON.parse(json) as Record<string, unknown>;
  return {
    number: number(pr.number, "number"),
    title: string(pr.title, "title"),
    url: string(pr.url, "url"),
    state: oneOf(pr.state, STATES, "state"),
    isDraft: pr.isDraft === true,
    reviewDecision:
      pr.reviewDecision === "" || pr.reviewDecision === null || pr.reviewDecision === undefined
        ? null
        : oneOf(
            pr.reviewDecision,
            ["APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"] as const,
            "reviewDecision",
          ),
    checks: summarizeChecks(pr.statusCheckRollup),
    mergeable: oneOf(pr.mergeable, ["MERGEABLE", "CONFLICTING", "UNKNOWN"] as const, "mergeable"),
    mergeStateStatus: oneOf(
      pr.mergeStateStatus,
      ["CLEAN", "BEHIND", "BLOCKED", "DIRTY", "UNSTABLE", "HAS_HOOKS", "UNKNOWN"] as const,
      "mergeStateStatus",
    ),
    updatedAt: date(pr.updatedAt, "updatedAt"),
    latestReviews: parseReviews(pr.latestReviews),
  };
}

const REVIEW_STATES = [
  "PENDING",
  "COMMENTED",
  "APPROVED",
  "CHANGES_REQUESTED",
  "DISMISSED",
] as const;

function parseReviews(reviews: unknown): PullRequest["latestReviews"] {
  if (!Array.isArray(reviews)) return [];
  return reviews.map((review: Record<string, unknown>) => ({
    author: string((review.author as Record<string, unknown> | undefined)?.login, "review author"),
    state: oneOf(review.state, REVIEW_STATES, "review state"),
  }));
}
