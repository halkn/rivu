import type { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { loadPreview } from "../files/preview";
import { listFiles } from "../git/files";
import { listCheckouts, loadLocalState } from "../git/local";
import { fetchPull, listPulls, resolvePr } from "../github/resolve";
import { hunkArgs, openInHunk } from "../hunk";
import type { Repository } from "../repository";
import type { Work } from "../work";
import { selectedFile } from "./browse";
import { changeRows } from "./format";
import { keyCommand } from "./keys";
import { initialState, reduce, selectedWork } from "./state";
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

  const { height } = useTerminalDimensions();
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const work = selectedWork(state);
  const browse = state.browse;

  // The Files and Changes tabs work on the selected checkout; start over when it changes.
  useEffect(() => {
    if (state.tab !== "overview" && work && browse?.path !== work.checkout.path) {
      dispatch({ type: "browseStart", path: work.checkout.path });
    }
  }, [state.tab, work, browse?.path]);

  const filesRequested = useRef<object | null>(null);
  useEffect(() => {
    if (state.tab !== "files" || !browse || browse.files.status !== "loading") return;
    if (filesRequested.current === browse) return;
    filesRequested.current = browse;
    const path = browse.path;
    listFiles(path).then(
      (value) =>
        dispatch({
          type: "browse",
          path,
          action: { type: "filesLoaded", files: { status: "loaded", value } },
        }),
      (error: unknown) =>
        dispatch({
          type: "browse",
          path,
          action: { type: "filesLoaded", files: { status: "error", message: message(error) } },
        }),
    );
  }, [state.tab, browse]);

  const file = browse ? selectedFile(browse) : null;
  useEffect(() => {
    if (!browse || file === null || browse.preview?.file === file) return;
    const path = browse.path;
    loadPreview(path, file).then(
      (value) =>
        dispatch({
          type: "browse",
          path,
          action: { type: "previewLoaded", file, value: { status: "loaded", value } },
        }),
      (error: unknown) =>
        dispatch({
          type: "browse",
          path,
          action: {
            type: "previewLoaded",
            file,
            value: { status: "error", message: message(error) },
          },
        }),
    );
  }, [browse, file]);

  const openHunk = (target: Work, path?: string) => {
    const unborn = /^0+$/.test(target.checkout.head.oid);
    const failure = openInHunk(renderer, target.checkout.path, hunkArgs({ unborn, path }));
    dispatch({ type: "message", text: failure });
    if (!failure) void load();
  };

  useKeyboard((key) => {
    const command = keyCommand(key, state);
    if (!command) return;
    if (state.message) dispatch({ type: "message", text: null });
    const rows = work?.local.status === "loaded" ? changeRows(work.local.value) : [];
    switch (command.kind) {
      case "quit":
        renderer.destroy();
        return;
      case "reload":
        void load();
        return;
      case "hunk":
        if (work) openHunk(work);
        return;
      case "hunkSelectedChange": {
        const row = rows[browse?.changeIndex ?? 0];
        if (work && row) openHunk(work, row.path);
        return;
      }
      case "dispatch":
        dispatch(command.action);
        return;
      case "browse":
        if (browse) dispatch({ type: "browse", path: browse.path, action: command.action });
        return;
      case "changeMove":
        if (browse) {
          dispatch({
            type: "browse",
            path: browse.path,
            action: { type: "changeMove", delta: command.delta, count: rows.length },
          });
        }
        return;
      case "scroll": {
        const lines = "lines" in command ? command.lines : Math.round(command.pages * height);
        scrollRef.current?.scrollBy(lines);
        return;
      }
    }
  });

  return <WorkView state={state} height={height} scrollRef={scrollRef} />;
}
