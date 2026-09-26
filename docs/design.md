# rivu 設計

データモデル・外部コマンドとの境界・UX の決定と理由。`src/` の型や Git / gh の呼び出しを変える前に読む。

## データモデル

Checkout（main checkout または linked worktree）と、その branch に対応する Pull Request の組を **Work** と呼ぶ。PR が無い Checkout も Work として扱う。

```ts
type Work = {
  checkout: Checkout;
  local: Loadable<LocalState>;
  pr: PrState; // feat/1-pull-requests で追加
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
};

type Loadable<T> =
  { status: "loading" } | { status: "loaded"; value: T } | { status: "error"; message: string };
```

- **Work の順序**: main checkout を先頭に置き、残りは `git worktree list` の順にする。一覧の並びが再読込のたびに変わらないようにするため
- **bare の main checkout**: 作業ツリーが無いので Work に含めない
- **prunable な worktree**: ディレクトリが無いため Git 状態は取得せず、prunable であることだけを表示する
- **Checkout ごとに独立して読み込む**: 1 つの Checkout の失敗（権限・壊れた worktree）で一覧全体を止めないため、`local` を `Loadable` にしている
- **upstream が無い**: `aheadBehind: null`。「push されていない branch」として表示する

## 外部コマンド

Git 2.50.1 / gh 2.101.0 の出力形式で確認した。

| 取得するもの                                 | コマンド                                                    |
| -------------------------------------------- | ----------------------------------------------------------- |
| Checkout の一覧                              | `git worktree list --porcelain -z`                          |
| branch・upstream・ahead/behind・変更ファイル | `git --no-optional-locks status --porcelain=v2 --branch -z` |
| 最新のコミット                               | `git log -1 --format=%H%x00%s%x00%ct`                       |

- **`-z` を使う**: パスを quote されずにそのまま受け取るため。改行を含むパスでも行の区切りと混同しない
- **`--no-optional-locks`**: `git status` は index を更新するために `index.lock` を取ることがある。rivu は読むだけのツールで、並行して動く Git 操作や Coding Agent と lock を奪い合わないようにするため
- **shell を経由しない**: コマンドは引数の配列で渡す。パスに空白やメタ文字が入っても解釈されないようにするため
- **未知の行は無視する**: porcelain v2 は「知らないヘッダーは無視すること」と定めているため、parser は未知の行でエラーにしない

## 表示

- **外部から来た文字列は描画前に制御文字を除く**: コミットメッセージ・パス・PR のタイトルに含まれるエスケープシーケンスで、端末が操作されるのを防ぐため
- **再読込は `r` による手動のみ**: ファイル監視は v0.1 の範囲外
- **キー**: `j` / `k`（`↓` / `↑`）で Work を選ぶ、`r` で再読込、`q` で終了
