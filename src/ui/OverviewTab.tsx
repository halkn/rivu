import type { ScrollBoxRenderable } from "@opentui/core";
import type { RefObject } from "react";
import type { PullRequest, Work } from "../work";
import {
  headLabel,
  lineTotals,
  prHeadline,
  prStatus,
  relativeTime,
  reviewsText,
  workSummary,
} from "./format";
import { Field, Muted, Segments } from "./parts";
import { sanitize, sanitizeBlock } from "./sanitize";
import { syntaxStyle } from "./syntax";

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
  const body = sanitizeBlock(pr.body).trim();
  return (
    <>
      <text>
        <strong>{`#${pr.number} ${sanitize(pr.title)}`}</strong>
      </text>
      <Muted>{sanitize(pr.url)}</Muted>
      <Segments segments={prStatus(work.pr)} />
      <Field label="Checks">{checksText(pr.checks)}</Field>
      <Field label="Review">
        {pr.reviewDecision ? pr.reviewDecision.toLowerCase().replace("_", " ") : "not required"}
      </Field>
      <Field label="Merge">{mergeText(pr)}</Field>
      <Field label="Reviews">{reviewsText(pr.latestReviews)}</Field>
      <Field label="Updated">{relativeTime(pr.updatedAt)}</Field>
      <text> </text>
      {body ? (
        <markdown content={body} syntaxStyle={syntaxStyle} width="100%" />
      ) : (
        <Muted>No description provided.</Muted>
      )}
    </>
  );
}

export function OverviewTab({
  work,
  scrollRef,
}: {
  work: Work;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
}) {
  const { checkout, local } = work;
  const flags = [
    checkout.isMain && "main checkout",
    checkout.locked && "locked",
    checkout.prunable && "prunable",
  ]
    .filter(Boolean)
    .join(", ");
  const totals = local.status === "loaded" ? lineTotals(local.value.lineStats) : null;
  return (
    <scrollbox ref={scrollRef} flexGrow={1}>
      <box flexDirection="column" paddingLeft={1} paddingRight={1}>
        <text>
          <strong>{headLabel(checkout)}</strong>
        </text>
        <Muted>{sanitize(checkout.path)}</Muted>
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
                ...(totals && totals.added + totals.deleted > 0
                  ? [`+${totals.added} −${totals.deleted}`]
                  : []),
              ].join(" · ")}
            </Field>
            <Field label="Commit">
              {local.value.latestCommit
                ? `${local.value.latestCommit.oid.slice(0, 7)} ${sanitize(local.value.latestCommit.subject)} (${relativeTime(local.value.latestCommit.committedAt)})`
                : "no commits yet"}
            </Field>
          </>
        ) : (
          <Muted>{workSummary(work)}</Muted>
        )}
        <text> </text>
        <PullRequestSection work={work} />
      </box>
    </scrollbox>
  );
}
