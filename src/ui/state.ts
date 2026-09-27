import type { Checkout, Loadable, LocalState, PrState, Work } from "../work";
import { initialBrowse, reduceBrowse, type Browse, type BrowseAction } from "./browse";

export type Tab = "overview" | "files" | "changes";

export type State = {
  works: Loadable<Work[]>;
  /** Tracked by path so the selection survives a reload that adds or removes worktrees. */
  selectedPath: string | null;
  tab: Tab;
  focus: "works" | "pane";
  browse: Browse | null;
  /** One-line notice in the footer, e.g. when Hunk is missing. */
  message: string | null;
};

export type Action =
  | { type: "checkoutsLoaded"; checkouts: Checkout[] }
  | { type: "checkoutsFailed"; message: string }
  | { type: "localLoaded"; path: string; local: Loadable<LocalState> }
  | { type: "prLoaded"; path: string; pr: PrState }
  | { type: "move"; delta: number }
  | { type: "focusToggle" }
  | { type: "tab"; tab: Tab }
  | { type: "browseStart"; path: string }
  | { type: "browse"; path: string; action: BrowseAction }
  | { type: "message"; text: string | null };

export const initialState: State = {
  works: { status: "loading" },
  selectedPath: null,
  tab: "overview",
  focus: "works",
  browse: null,
  message: null,
};

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "checkoutsLoaded": {
      const works: Work[] = action.checkouts.map((checkout) => ({
        checkout,
        local: { status: "loading" },
        pr: { status: "loading" },
      }));
      const kept = works.some((work) => work.checkout.path === state.selectedPath);
      return {
        ...state,
        works: { status: "loaded", value: works },
        selectedPath: kept ? state.selectedPath : (works[0]?.checkout.path ?? null),
        browse: null,
      };
    }
    case "checkoutsFailed":
      return {
        ...state,
        works: { status: "error", message: action.message },
        selectedPath: null,
        browse: null,
      };
    case "localLoaded":
      return updateWork(state, action.path, (work) => ({ ...work, local: action.local }));
    case "prLoaded":
      return updateWork(state, action.path, (work) => ({ ...work, pr: action.pr }));
    case "move": {
      if (state.works.status !== "loaded" || state.works.value.length === 0) return state;
      const works = state.works.value;
      const current = Math.max(
        0,
        works.findIndex((work) => work.checkout.path === state.selectedPath),
      );
      const next = Math.min(works.length - 1, Math.max(0, current + action.delta));
      const selectedPath = works[next]!.checkout.path;
      if (selectedPath === state.selectedPath) return state;
      return { ...state, selectedPath, browse: null };
    }
    case "focusToggle":
      return { ...state, focus: state.focus === "works" ? "pane" : "works" };
    case "tab":
      return { ...state, tab: action.tab };
    case "browseStart":
      return { ...state, browse: initialBrowse(action.path) };
    case "browse":
      if (state.browse?.path !== action.path) return state;
      return { ...state, browse: reduceBrowse(state.browse, action.action) };
    case "message":
      return { ...state, message: action.text };
  }
}

function updateWork(state: State, path: string, update: (work: Work) => Work): State {
  if (state.works.status !== "loaded") return state;
  const works = state.works.value.map((work) =>
    work.checkout.path === path ? update(work) : work,
  );
  return { ...state, works: { status: "loaded", value: works } };
}

export function selectedWork(state: State): Work | undefined {
  if (state.works.status !== "loaded") return undefined;
  return state.works.value.find((work) => work.checkout.path === state.selectedPath);
}
