import type { Checkout, Loadable, LocalState, PrState, Work } from "../work";

export type State = {
  works: Loadable<Work[]>;
  /** Tracked by path so the selection survives a reload that adds or removes worktrees. */
  selectedPath: string | null;
};

export type Action =
  | { type: "checkoutsLoaded"; checkouts: Checkout[] }
  | { type: "checkoutsFailed"; message: string }
  | { type: "localLoaded"; path: string; local: Loadable<LocalState> }
  | { type: "prLoaded"; path: string; pr: PrState }
  | { type: "move"; delta: number };

export const initialState: State = { works: { status: "loading" }, selectedPath: null };

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
        works: { status: "loaded", value: works },
        selectedPath: kept ? state.selectedPath : (works[0]?.checkout.path ?? null),
      };
    }
    case "checkoutsFailed":
      return { works: { status: "error", message: action.message }, selectedPath: null };
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
      return { ...state, selectedPath: works[next]!.checkout.path };
    }
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
