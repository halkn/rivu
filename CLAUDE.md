# rivu

Git repository 内の checkout と Pull Request を俯瞰する read-only の TUI。OpenTUI（React）+ TypeScript + Bun。

## 読むもの

- `src/work.ts` の型、`src/git/` の Git 呼び出し、表示する文字列の扱いを変える前に `docs/design.md`
- 依存（OpenTUI / Bun）の更新やテストの書き方で迷ったら `docs/adr/0001-tech-stack.md`

## 検証

```sh
bun run fmt
bun run lint
bun run typecheck
bun test
```

- Git の parser は porcelain 出力の fixture で、Git 呼び出しは一時 repository を作る統合テストで検証する
- 画面は `testRender` で文字列として検証する。日本語を含むレイアウトはテスト用 renderer で正しく折り返されないため、実端末で確認する
- 実端末での確認には `scripts/playground/` で状態を揃えた repository を使う。`local.sh` はネットワーク不要、`github.sh` は GitHub に branch と PR を作る（実行前にユーザーの確認を取る）。shell script は `shuck check` で検査する
