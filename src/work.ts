// Domain types for a Work: a checkout and its related state. See docs/design.md.

export type Head =
  | { kind: "branch"; name: string; oid: string }
  | { kind: "detached"; oid: string };

export type Checkout = {
  path: string;
  isMain: boolean;
  head: Head;
  locked: boolean;
  prunable: boolean;
};

export type FileChange = {
  path: string;
  /** Status letter from `git status`: M, A, D, R, C or T. */
  code: string;
  origPath?: string;
};

export type LocalStatus = {
  upstream: string | null;
  aheadBehind: { ahead: number; behind: number } | null;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
  conflicted: string[];
};

export type Commit = { oid: string; subject: string; committedAt: Date };

export type LocalState = LocalStatus & {
  latestCommit: Commit | null;
  /** Name of the upstream branch on its remote; null when there is no upstream or it is a local branch. */
  upstreamBranch: string | null;
  /** Lines changed against HEAD; null on a branch without commits. */
  lineStats: LineStat[] | null;
};

export type Preview =
  | { kind: "text"; content: string; truncated: boolean }
  | { kind: "binary" }
  | { kind: "symlink"; target: string }
  | { kind: "missing" };

/** Lines changed against HEAD; null counts mean a binary file. */
export type LineStat = { path: string; added: number | null; deleted: number | null };

export type Loadable<T> =
  | { status: "loading" }
  | { status: "loaded"; value: T }
  | { status: "error"; message: string };

export type PullRequest = {
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "MERGED" | "CLOSED";
  isDraft: boolean;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  checks: { passed: number; failed: number; pending: number };
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  mergeStateStatus: "CLEAN" | "BEHIND" | "BLOCKED" | "DIRTY" | "UNSTABLE" | "HAS_HOOKS" | "UNKNOWN";
  updatedAt: Date;
  /** Markdown as written on GitHub; empty when the PR has no description. */
  body: string;
  latestReviews: { author: string; state: ReviewState }[];
};

export type ReviewState = "PENDING" | "COMMENTED" | "APPROVED" | "CHANGES_REQUESTED" | "DISMISSED";

export type PrState =
  | { status: "loading" }
  | { status: "unavailable"; reason: string }
  | { status: "none" }
  | { status: "error"; message: string }
  | { status: "found"; value: PullRequest };

export type Work = {
  checkout: Checkout;
  local: Loadable<LocalState>;
  pr: PrState;
};
