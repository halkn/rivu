import type { Checkout, PrState, PullRequest } from "../work";
import { runGh } from "./gh";
import {
  branchCandidates,
  findPull,
  parsePullDetail,
  parsePullList,
  type PullListItem,
} from "./pulls";

const LIST_FIELDS = "number,headRefName,isCrossRepository,state";
const DETAIL_FIELDS =
  "number,title,url,state,isDraft,reviewDecision,statusCheckRollup,mergeable,mergeStateStatus,updatedAt,latestReviews";

export type PullIndex = { pulls: PullListItem[]; defaultBranch: string | null };

export async function listPulls(cwd: string): Promise<PullIndex> {
  const [pulls, defaultBranch] = await Promise.all([
    runGh(cwd, ["pr", "list", "--state", "all", "--limit", "100", "--json", LIST_FIELDS]).then(
      parsePullList,
    ),
    // Only narrows branch matching, so PRs are still shown when this lookup fails.
    runGh(cwd, [
      "repo",
      "view",
      "--json",
      "defaultBranchRef",
      "--jq",
      ".defaultBranchRef.name",
    ]).then(
      (out) => out.trim() || null,
      () => null,
    ),
  ]);
  return { pulls, defaultBranch };
}

export async function fetchPull(cwd: string, number: number): Promise<PullRequest> {
  return parsePullDetail(await runGh(cwd, ["pr", "view", String(number), "--json", DETAIL_FIELDS]));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function resolvePr(
  checkout: Checkout,
  upstreamBranch: string | null,
  index: Promise<PullIndex>,
  fetchDetail: (number: number) => Promise<PullRequest>,
): Promise<PrState> {
  let resolved;
  try {
    resolved = await index;
  } catch (error) {
    return { status: "unavailable", reason: message(error) };
  }
  const match = branchCandidates(checkout, upstreamBranch, resolved.defaultBranch)
    .map((branch) => findPull(resolved.pulls, branch))
    .find((pull) => pull !== undefined);
  if (!match) return { status: "none" };
  try {
    return { status: "found", value: await fetchDetail(match.number) };
  } catch (error) {
    return { status: "error", message: message(error) };
  }
}
