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

export type LocalState = LocalStatus & { latestCommit: Commit | null };

export type Loadable<T> =
  | { status: "loading" }
  | { status: "loaded"; value: T }
  | { status: "error"; message: string };

export type Work = {
  checkout: Checkout;
  local: Loadable<LocalState>;
};
