import type { Work } from "../work";
import { headLabel, relativeTime, workSummary } from "./format";
import { sanitize } from "./sanitize";
import { selectedWork, type State } from "./state";

const DIM = "#697098";
const SELECTED_BG = "#2f3449";

function WorkList({ works, selectedPath }: { works: Work[]; selectedPath: string | null }) {
  return (
    <box flexDirection="column">
      {works.map((work) => {
        const selected = work.checkout.path === selectedPath;
        return (
          <box
            key={work.checkout.path}
            flexDirection="column"
            paddingLeft={1}
            backgroundColor={selected ? SELECTED_BG : undefined}
          >
            <text>
              <strong>{headLabel(work.checkout)}</strong>
              {work.checkout.isMain ? <span fg={DIM}> (main checkout)</span> : null}
            </text>
            <text fg={DIM}>{`  ${workSummary(work)}`}</text>
          </box>
        );
      })}
    </box>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <text>
      <span fg={DIM}>{label.padEnd(10)}</span>
      {value}
    </text>
  );
}

function Overview({ work }: { work: Work }) {
  const { checkout, local } = work;
  const flags = [
    checkout.isMain && "main checkout",
    checkout.locked && "locked",
    checkout.prunable && "prunable",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <box flexDirection="column" paddingLeft={1}>
      <text>
        <strong>{headLabel(checkout)}</strong>
      </text>
      <text fg={DIM}>{sanitize(checkout.path)}</text>
      <text> </text>
      {flags ? <Field label="Checkout" value={flags} /> : null}
      {local.status === "loaded" ? (
        <>
          <Field
            label="Upstream"
            value={
              local.value.upstream === null
                ? "not pushed"
                : `${sanitize(local.value.upstream)}${
                    local.value.aheadBehind
                      ? ` (↑${local.value.aheadBehind.ahead} ↓${local.value.aheadBehind.behind})`
                      : ""
                  }`
            }
          />
          <Field
            label="Changes"
            value={[
              `${local.value.staged.length} staged`,
              `${local.value.unstaged.length} unstaged`,
              `${local.value.untracked.length} untracked`,
              `${local.value.conflicted.length} conflicted`,
            ].join(" · ")}
          />
          <Field
            label="Commit"
            value={
              local.value.latestCommit
                ? `${local.value.latestCommit.oid.slice(0, 7)} ${sanitize(local.value.latestCommit.subject)} (${relativeTime(local.value.latestCommit.committedAt)})`
                : "no commits yet"
            }
          />
        </>
      ) : (
        <text fg={DIM}>{workSummary(work)}</text>
      )}
    </box>
  );
}

export function WorkView({ state }: { state: State }) {
  const selected = selectedWork(state);
  return (
    <box flexDirection="column" width="100%" height="100%">
      <box flexDirection="row" flexGrow={1}>
        <box title="Works" border width="40%">
          {state.works.status === "loading" ? <text fg={DIM}>loading…</text> : null}
          {state.works.status === "error" ? (
            <text fg="#f07178">{sanitize(state.works.message)}</text>
          ) : null}
          {state.works.status === "loaded" ? (
            <WorkList works={state.works.value} selectedPath={state.selectedPath} />
          ) : null}
        </box>
        <box title="Overview" border flexGrow={1}>
          {selected ? <Overview work={selected} /> : null}
        </box>
      </box>
      <text fg={DIM}>j/k: select r: reload q: quit</text>
    </box>
  );
}
