import type { PullRequest, Work } from "../work";
import {
  headLabel,
  localSegments,
  prHeadline,
  prStatus,
  relativeTime,
  reviewsText,
  type Segment,
  workSummary,
} from "./format";
import { sanitize } from "./sanitize";
import { selectedWork, type State } from "./state";
import { colors, toneColors } from "./theme";

function Segments({
  segments,
  indent = "",
  separator = " · ",
}: {
  segments: Segment[];
  indent?: string;
  separator?: string;
}) {
  if (segments.length === 0) return null;
  return (
    <text>
      {indent}
      {segments.map((segment, index) => (
        <span key={index}>
          {index > 0 ? <span fg={colors.muted}>{separator}</span> : null}
          <span fg={toneColors[segment.tone]}>{segment.text}</span>
        </span>
      ))}
    </text>
  );
}

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
            marginBottom={1}
            backgroundColor={selected ? colors.selectedBackground : undefined}
          >
            <text>
              <strong>{headLabel(work.checkout)}</strong>
              {work.checkout.isMain ? <span fg={colors.muted}>{" (main checkout)"}</span> : null}
            </text>
            <Segments segments={localSegments(work)} indent="  " />
            <Segments segments={prHeadline(work.pr)} indent="  " separator=" " />
            <Segments segments={prStatus(work.pr)} indent="     " />
          </box>
        );
      })}
    </box>
  );
}

function Field({ label, children }: { label: string; children: string }) {
  return (
    <text>
      <span fg={colors.muted}>{label.padEnd(10)}</span>
      {children}
    </text>
  );
}

function checksText(checks: PullRequest["checks"]): string {
  if (checks.passed + checks.failed + checks.pending === 0) return "no checks";
  return `${checks.passed} passed · ${checks.failed} failed · ${checks.pending} pending`;
}

function mergeText(pr: PullRequest): string {
  if (pr.state !== "OPEN") return pr.state === "MERGED" ? "merged" : "closed";
  if (pr.mergeable === "CONFLICTING") return "conflicts with the base branch";
  return pr.mergeStateStatus.toLowerCase().replace("_", " ");
}

function PullRequestSection({ work }: { work: Work }) {
  if (work.pr.status !== "found") return <Segments segments={prHeadline(work.pr)} />;
  const pr = work.pr.value;
  return (
    <>
      <text>
        <strong>{`#${pr.number} ${sanitize(pr.title)}`}</strong>
      </text>
      <text fg={colors.muted}>{sanitize(pr.url)}</text>
      <Segments segments={prStatus(work.pr)} />
      <Field label="Checks">{checksText(pr.checks)}</Field>
      <Field label="Review">
        {pr.reviewDecision ? pr.reviewDecision.toLowerCase().replace("_", " ") : "not required"}
      </Field>
      <Field label="Merge">{mergeText(pr)}</Field>
      <Field label="Reviews">{reviewsText(pr.latestReviews)}</Field>
      <Field label="Updated">{relativeTime(pr.updatedAt)}</Field>
    </>
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
      <text fg={colors.muted}>{sanitize(checkout.path)}</text>
      <text> </text>
      {flags ? <Field label="Checkout">{flags}</Field> : null}
      {local.status === "loaded" ? (
        <>
          <Field label="Upstream">
            {local.value.upstream === null
              ? "not pushed"
              : `${sanitize(local.value.upstream)}${
                  local.value.aheadBehind
                    ? ` (↑${local.value.aheadBehind.ahead} ↓${local.value.aheadBehind.behind})`
                    : ""
                }`}
          </Field>
          <Field label="Changes">
            {[
              `${local.value.staged.length} staged`,
              `${local.value.unstaged.length} unstaged`,
              `${local.value.untracked.length} untracked`,
              `${local.value.conflicted.length} conflicted`,
            ].join(" · ")}
          </Field>
          <Field label="Commit">
            {local.value.latestCommit
              ? `${local.value.latestCommit.oid.slice(0, 7)} ${sanitize(local.value.latestCommit.subject)} (${relativeTime(local.value.latestCommit.committedAt)})`
              : "no commits yet"}
          </Field>
        </>
      ) : (
        <text fg={colors.muted}>{workSummary(work)}</text>
      )}
      <text> </text>
      <PullRequestSection work={work} />
    </box>
  );
}

export function WorkView({ state }: { state: State }) {
  const selected = selectedWork(state);
  return (
    <box flexDirection="column" width="100%" height="100%">
      <box flexDirection="row" flexGrow={1}>
        <box title="Works" border width="40%">
          {state.works.status === "loading" ? <text fg={colors.muted}>loading…</text> : null}
          {state.works.status === "error" ? (
            <text fg={toneColors.danger}>{sanitize(state.works.message)}</text>
          ) : null}
          {state.works.status === "loaded" ? (
            <WorkList works={state.works.value} selectedPath={state.selectedPath} />
          ) : null}
        </box>
        <box title="Overview" border flexGrow={1}>
          {selected ? <Overview work={selected} /> : null}
        </box>
      </box>
      <text fg={colors.muted}>{"j/k: select  r: reload  q: quit"}</text>
    </box>
  );
}
