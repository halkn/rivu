# rivu 設計

データモデル・外部コマンドとの境界・UX の決定と理由。`src/` の型や Git / gh の呼び出しを変える前に読む。

## データモデル

Checkout（main checkout または linked worktree）と、その branch に対応する Pull Request の組を **Work** と呼ぶ。PR が無い Checkout も Work として扱う。

```ts
type Work = {
  checkout: Checkout;
  local: Loadable<LocalState>;
  pr: PrState;
};

type Checkout = {
  path: string;
  isMain: boolean;
  head: { kind: "branch"; name: string; oid: string } | { kind: "detached"; oid: string };
  locked: boolean;
  prunable: boolean;
};

type LocalState = {
  upstream: string | null;
  aheadBehind: { ahead: number; behind: number } | null;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
  conflicted: string[];
  latestCommit: { oid: string; subject: string; committedAt: Date } | null;
  upstreamBranch: string | null; // upstream の remote 側の branch 名。upstream が無い・local の branch なら null
};

type Loadable<T> =
  { status: "loading" } | { status: "loaded"; value: T } | { status: "error"; message: string };
```

- **Work の順序**: main checkout を先頭に置き、残りは `git worktree list` の順にする。一覧の並びが再読込のたびに変わらないようにするため
- **bare の main checkout**: 作業ツリーが無いので Work に含めない
- **prunable な worktree**: ディレクトリが無いため Git 状態は取得せず、prunable であることだけを表示する
- **Checkout ごとに独立して読み込む**: 1 つの Checkout の失敗（権限・壊れた worktree）で一覧全体を止めないため、`local` を `Loadable` にしている
- **upstream が無い**: `aheadBehind: null`。「push されていない branch」として表示する

### Pull Request

```ts
type PrState =
  | { status: "loading" }
  | { status: "unavailable"; reason: string } // gh が使えない。repository 全体で共通
  | { status: "none" } // detached、または対応する PR が無い
  | { status: "error"; message: string } // この Work の PR の取得に失敗した
  | { status: "found"; value: PullRequest };

type PullRequest = {
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "MERGED" | "CLOSED";
  isDraft: boolean;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  checks: { passed: number; failed: number; pending: number };
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  mergeStateStatus: "CLEAN" | "BEHIND" | "BLOCKED" | "DIRTY" | "UNSTABLE" | "HAS_HOOKS" | "UNKNOWN";
  updatedAt: Date;
  latestReviews: {
    author: string;
    state: "PENDING" | "COMMENTED" | "APPROVED" | "CHANGES_REQUESTED" | "DISMISSED";
  }[];
};
```

- **対応付けに使う branch 名**: まず local の branch 名、見つからなければ upstream が指す remote 側の branch 名で探す。upstream は push 先とは限らず（`origin/main` から作った branch や、local の branch を upstream にした branch）、upstream を優先すると無関係な PR を表示するため。remote 側の branch 名が repository の既定 branch なら探さない（既定 branch から作って未 push の branch が、既定 branch を head にした PR を拾わないように）
- **複数の PR が一致する**: fork からの PR（`isCrossRepository`）は除き、OPEN を優先し、無ければ最も新しいものを採る。merge 済みの PR も表示するのは、その worktree を片付けてよいかの判断に使えるため
- **一覧は新しい順に 100 件まで**: それより古い PR しか無い branch は「PR 無し」として扱う
- **CI の集計**: CheckRun は完了前を pending、`FAILURE` / `TIMED_OUT` / `CANCELLED` / `ACTION_REQUIRED` / `STARTUP_FAILURE` を failed、`SUCCESS` を passed とし、`NEUTRAL` / `SKIPPED` / `STALE` は数えない。StatusContext は `SUCCESS` を passed、`FAILURE` / `ERROR` を failed、`PENDING` / `EXPECTED` を pending とする
- **議論の中身は取らない**: 最後に誰がどう動いたかは `latestReviews` と `updatedAt` だけで示す。コメント本文はコメントとレビューの合成や bot の除外（`latestReviews` の author には bot の印が無い）が要り、読むのは GitHub の役目なため
- **gh が使えないときは PR だけを諦める**: gh が無い・未認証・GitHub 以外の remote でも、local の状態は表示する

## 外部コマンド

Git 2.50.1 / gh 2.101.0 の出力形式で確認した。

| 取得するもの                                 | コマンド                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout の一覧                              | `git worktree list --porcelain -z`                                                                                                              |
| branch・upstream・ahead/behind・変更ファイル | `git --no-optional-locks status --porcelain=v2 --branch -z`                                                                                     |
| 最新のコミット                               | `git log -1 --format=%H%x00%s%x00%ct`                                                                                                           |
| upstream の remote 側の branch 名            | `git for-each-ref --format=%(upstream:remotename)%00%(upstream:remoteref) refs/heads/<branch>`                                                  |
| PR の一覧                                    | `gh pr list --state all --limit 100 --json number,headRefName,isCrossRepository,state`                                                          |
| 既定 branch                                  | `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`                                                                              |
| PR の詳細                                    | `gh pr view <number> --json number,title,url,state,isDraft,reviewDecision,statusCheckRollup,mergeable,mergeStateStatus,updatedAt,latestReviews` |

- **`-z` を使う**: パスを quote されずにそのまま受け取るため。改行を含むパスでも行の区切りと混同しない
- **`--no-optional-locks`**: `git status` は index を更新するために `index.lock` を取ることがある。rivu は読むだけのツールで、並行して動く Git 操作や Coding Agent と lock を奪い合わないようにするため
- **shell を経由しない**: コマンドは引数の配列で渡す。パスに空白やメタ文字が入っても解釈されないようにするため
- **未知の行は無視する**: porcelain v2 は「知らないヘッダーは無視すること」と定めているため、parser は未知の行でエラーにしない
- **PR は一覧と詳細の 2 段で取る**: `statusCheckRollup` は PR ごとに数十件の check を含み重い。一覧は軽いフィールドだけで取り、詳細は Work に対応した PR にだけ取りに行く
- **gh は非対話で呼ぶ**: `GH_PROMPT_DISABLED=1` を渡し、stdin は渡さない。TUI が端末を使っている間に gh が入力を待つと、操作できなくなるため。`GH_NO_UPDATE_NOTIFIER=1` と `NO_COLOR=1` で、出力を parse の対象だけにする
- **gh の失敗の区別**: 起動できない（未インストール）と終了コード 4（未認証）は理由を示して PR の表示を諦める。それ以外（GitHub 以外の remote など）は gh のエラーメッセージの 1 行目を表示する

## 表示

- **外部から来た文字列は描画前に制御文字を除く**: コミットメッセージ・パス・PR のタイトルに含まれるエスケープシーケンスで、端末が操作されるのを防ぐため
- **一覧の PR は 2 行で出す**: 1 行目に番号とタイトル（draft / merged / closed の印）、2 行目に CI・review・merge の状態。何の PR がどの状態かを、一覧だけで読めるようにするため。merged / closed の PR は 2 行目を出さない
- **色は状態の意味で決める**: success（clean・CI 成功・Approved・Mergeable）、warning（未コミットの変更・CI 実行中・Review required・Behind base・Blocked）、danger（conflict・CI 失敗・Changes requested）、accent（未 push・ahead/behind・PR のタイトル）、muted（読込中・PR 無し・draft / merged / closed の印）。一覧を流し見して、手を付けるべき Work が色で分かるようにするため
- **再読込は `r` による手動のみ**: ファイル監視は v0.1 の範囲外
- **キー**: `j` / `k`（`↓` / `↑`）で Work を選ぶ、`r` で再読込、`q` で終了
