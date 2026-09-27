import { useKeyboard, useRenderer } from "@opentui/react";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { listCheckouts, loadLocalState } from "../git/local";
import { fetchPull, listPulls, resolvePr } from "../github/resolve";
import type { Repository } from "../repository";
import { initialState, reduce } from "./state";
import { WorkView } from "./WorkView";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function App({ repository }: { repository: Repository }) {
  const renderer = useRenderer();
  const [state, dispatch] = useReducer(reduce, initialState);
  // Results from a load that a later reload has superseded are dropped.
  const generation = useRef(0);

  const load = useCallback(async () => {
    const current = ++generation.current;
    const isCurrent = () => current === generation.current;
    let checkouts;
    try {
      checkouts = await listCheckouts(repository.root);
    } catch (error) {
      if (isCurrent()) dispatch({ type: "checkoutsFailed", message: message(error) });
      return;
    }
    if (!isCurrent()) return;
    dispatch({ type: "checkoutsLoaded", checkouts });

    const pulls = listPulls(repository.root);
    // Each work awaits this; the catch only keeps a failure from being reported as unhandled.
    pulls.catch(() => undefined);
    const fetchDetail = (number: number) => fetchPull(repository.root, number);

    await Promise.all(
      checkouts.map(async (checkout) => {
        let upstreamBranch: string | null = null;
        if (!checkout.prunable) {
          const local = await loadLocalState(checkout).then(
            (value) => ({ status: "loaded", value }) as const,
            (error: unknown) => ({ status: "error", message: message(error) }) as const,
          );
          if (!isCurrent()) return;
          dispatch({ type: "localLoaded", path: checkout.path, local });
          if (local.status === "loaded") upstreamBranch = local.value.upstreamBranch;
        }
        const pr = await resolvePr(checkout, upstreamBranch, pulls, fetchDetail);
        if (isCurrent()) dispatch({ type: "prLoaded", path: checkout.path, pr });
      }),
    );
  }, [repository.root]);

  useEffect(() => {
    void load();
  }, [load]);

  useKeyboard((key) => {
    if (key.name === "q") renderer.destroy();
    else if (key.name === "r") void load();
    else if (key.name === "j" || key.name === "down") dispatch({ type: "move", delta: 1 });
    else if (key.name === "k" || key.name === "up") dispatch({ type: "move", delta: -1 });
  });

  return <WorkView state={state} />;
}
