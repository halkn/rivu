// Files and Changes tab state for the selected work.
import type { Loadable, Preview } from "../work";
import { buildTree, parentDir, visibleRows, type TreeRow } from "./tree";

export type Browse = {
  /** Checkout the files belong to; the state is dropped when another work is selected. */
  path: string;
  files: Loadable<string[]>;
  open: string[];
  cursor: string | null;
  preview: { file: string; value: Loadable<Preview> } | null;
  changeIndex: number;
};

export type BrowseAction =
  | { type: "filesLoaded"; files: Loadable<string[]> }
  | { type: "treeMove"; delta: number }
  | { type: "treeOpen" }
  | { type: "treeClose" }
  | { type: "previewLoaded"; file: string; value: Loadable<Preview> }
  | { type: "changeMove"; delta: number; count: number };

export function initialBrowse(path: string): Browse {
  return {
    path,
    files: { status: "loading" },
    open: [],
    cursor: null,
    preview: null,
    changeIndex: 0,
  };
}

export function treeRows(browse: Browse): TreeRow[] {
  if (browse.files.status !== "loaded") return [];
  return visibleRows(buildTree(browse.files.value), new Set(browse.open));
}

export function selectedFile(browse: Browse): string | null {
  const row = treeRows(browse).find((candidate) => candidate.path === browse.cursor);
  return row?.kind === "file" ? row.path : null;
}

function moveCursor(browse: Browse, cursor: string | null): Browse {
  return cursor === browse.cursor ? browse : { ...browse, cursor, preview: null };
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(0, value), Math.max(0, max));
}

export function reduceBrowse(browse: Browse, action: BrowseAction): Browse {
  const rows = treeRows(browse);
  const index = Math.max(
    0,
    rows.findIndex((row) => row.path === browse.cursor),
  );
  const row = rows[index];
  switch (action.type) {
    case "filesLoaded": {
      const next = { ...browse, files: action.files };
      return moveCursor(next, treeRows(next)[0]?.path ?? null);
    }
    case "treeMove":
      return moveCursor(browse, rows[clamp(index + action.delta, rows.length - 1)]?.path ?? null);
    case "treeOpen":
      if (row?.kind !== "dir") return browse;
      if (!row.open) return { ...browse, open: [...browse.open, row.path] };
      return reduceBrowse(browse, { type: "treeMove", delta: 1 });
    case "treeClose": {
      const dir = row?.kind === "dir" && row.open ? row.path : row && parentDir(row.path);
      if (!dir) return browse;
      return moveCursor({ ...browse, open: browse.open.filter((path) => path !== dir) }, dir);
    }
    case "previewLoaded":
      if (action.file !== selectedFile(browse)) return browse;
      return { ...browse, preview: { file: action.file, value: action.value } };
    case "changeMove":
      return { ...browse, changeIndex: clamp(browse.changeIndex + action.delta, action.count - 1) };
  }
}
