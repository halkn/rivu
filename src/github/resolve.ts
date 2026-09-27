import type { Checkout, PrState, PullRequest } from "../work";
import { runGh } from "./gh";
import {
  findPull,
  parsePullDetail,
  parsePullList,
  pullBranchName,
  type PullListItem,
} from "./pulls";

const LIST_FIELDS = "number,headRefName,isCrossRepository,state";
const DETAIL_FIELDS =
  "number,title,url,state,isDraft,reviewDecision,statusCheckRollup,mergeable,mergeStateStatus,updatedAt,latestReviews";

export async function listPulls(cwd: string): Promise<PullListItem[]> {
  const out = await runGh(cwd, [
    "pr",
    "list",
    "--state",
    "all",
    "--limit",
    "100",
    "--json",
    LIST_FIELDS,
  ]);
  return parsePullList(out);
}

export async function fetchPull(cwd: string, number: number): Promise<PullRequest> {
  return parsePullDetail(await runGh(cwd, ["pr", "view", String(number), "--json", DETAIL_FIELDS]));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function resolvePr(
  checkout: Checkout,
  upstream: string | null,
  pulls: Promise<PullListItem[]>,
  fetchDetail: (number: number) => Promise<PullRequest>,
): Promise<PrState> {
  let list;
  try {
    list = await pulls;
  } catch (error) {
    return { status: "unavailable", reason: message(error) };
  }
  const branch = pullBranchName(checkout, upstream);
  const match = branch === null ? undefined : findPull(list, branch);
  if (!match) return { status: "none" };
  try {
    return { status: "found", value: await fetchDetail(match.number) };
  } catch (error) {
    return { status: "error", message: message(error) };
  }
}
