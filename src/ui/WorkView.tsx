import type { ScrollBoxRenderable } from "@opentui/core";
import type { RefObject } from "react";
import type { Work } from "../work";
import { ChangesTab } from "./ChangesTab";
import { FilesTab } from "./FilesTab";
import { changeRows, headLabel, localSegments, prHeadline, prStatus } from "./format";
import { OverviewTab } from "./OverviewTab";
import { Muted, Segments } from "./parts";
import { sanitize } from "./sanitize";
import { selectedWork, type State, type Tab } from "./state";
import { colors, toneColors } from "./theme";
import { visibleWindow } from "./window";

// Branch, local summary, PR headline, PR status and a blank line.
const WORK_ROWS = 5;
// Borders, the tab bar and the footer around a pane's content.
const CHROME_ROWS = 4;

function WorkList({
  works,
  selectedPath,
  height,
}: {
  works: Work[];
  selectedPath: string | null;
  height: number;
}) {
  const index = works.findIndex((work) => work.checkout.path === selectedPath);
  return (
    <box flexDirection="column">
      {visibleWindow(works, index, Math.max(1, Math.floor(height / WORK_ROWS))).map((work) => (
        <box
          key={work.checkout.path}
          flexDirection="column"
          paddingLeft={1}
          marginBottom={1}
          backgroundColor={
            work.checkout.path === selectedPath ? colors.selectedBackground : undefined
          }
        >
          <text>
            <strong>{headLabel(work.checkout)}</strong>
            {work.checkout.isMain ? <span fg={colors.muted}>{" (main checkout)"}</span> : null}
          </text>
          <Segments segments={localSegments(work)} indent="  " />
          <Segments segments={prHeadline(work.pr)} indent="  " separator=" " />
          <Segments segments={prStatus(work.pr)} indent="     " />
        </box>
      ))}
    </box>
  );
}

const TAB_LABELS: [Tab, string][] = [
  ["overview", "1 Overview"],
  ["files", "2 Files"],
  ["changes", "3 Changes"],
];

function TabBar({ tab }: { tab: Tab }) {
  return (
    <text>
      {TAB_LABELS.map(([key, label]) => (
        <span key={key} fg={key === tab ? toneColors.accent : colors.muted}>
          {key === tab ? `[${label}]  ` : ` ${label}   `}
        </span>
      ))}
    </text>
  );
}

function Pane({
  state,
  work,
  height,
  scrollRef,
}: {
  state: State;
  work: Work;
  height: number;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
}) {
  const rows = work.local.status === "loaded" ? changeRows(work.local.value) : [];
  switch (state.tab) {
    case "overview":
      return <OverviewTab work={work} scrollRef={scrollRef} />;
    case "files":
      return (
        <FilesTab
          browse={state.browse}
          statuses={new Map(rows.map((row) => [row.path, row.status]))}
          height={height}
          scrollRef={scrollRef}
        />
      );
    case "changes":
      return <ChangesTab rows={rows} index={state.browse?.changeIndex ?? 0} height={height} />;
  }
}

const KEYS =
  "Tab: focus  1/2/3: tab  j/k: move  Enter/l/h: open/close  C-d/C-u: scroll  d: hunk  r: reload  q: quit";

function border(focused: boolean): string {
  return focused ? toneColors.accent : colors.muted;
}

export function WorkView({
  state,
  height,
  scrollRef,
}: {
  state: State;
  height: number;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
}) {
  const selected = selectedWork(state);
  const paneHeight = Math.max(1, height - CHROME_ROWS);
  return (
    <box flexDirection="column" width="100%" height="100%">
      <box flexDirection="row" flexGrow={1}>
        <box
          title="Works"
          border
          borderColor={border(state.focus === "works")}
          width="40%"
          flexShrink={0}
        >
          {state.works.status === "loading" ? <Muted>loading…</Muted> : null}
          {state.works.status === "error" ? (
            <text fg={toneColors.danger}>{sanitize(state.works.message)}</text>
          ) : null}
          {state.works.status === "loaded" ? (
            <WorkList
              works={state.works.value}
              selectedPath={state.selectedPath}
              height={paneHeight}
            />
          ) : null}
        </box>
        <box
          border
          borderColor={border(state.focus === "pane")}
          flexGrow={1}
          flexDirection="column"
        >
          <TabBar tab={state.tab} />
          {selected ? (
            <Pane state={state} work={selected} height={paneHeight - 1} scrollRef={scrollRef} />
          ) : null}
        </box>
      </box>
      <text fg={state.message ? toneColors.warning : colors.muted}>
        {state.message ? sanitize(state.message) : KEYS}
      </text>
    </box>
  );
}
