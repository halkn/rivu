# 0001: OpenTUI + TypeScript + Bun で実装する

## 決定

v0.1 を OpenTUI（React renderer）+ TypeScript + Bun で実装する。

## 理由

rivu は画面構成を試行錯誤しながら育てるツールなので、UI を宣言的に組み替えやすいことを最優先にした。比較した候補は Rust + Ratatui と Go + Bubble Tea。

- **UI の変更容易性**: Yoga（flexbox）レイアウトと React で画面を組める。Ratatui は Constraint を手で組み、Bubble Tea は Lip Gloss で文字列を連結するため、構成の変更にかかる手数が多い
- **preview**: source と Markdown の preview に `<code>` / `<markdown>` をそのまま使える
- **Hunk への委譲**: `renderer.suspend()` → 子プロセス → `renderer.resume()` で端末を受け渡せる

Rust を選ばなかった理由: mdvu と実装を共有できる利点はあるが、mdvu は bin crate で依存にできずコピーになる。UI の変更に手数がかかる点がそれを上回った。

## spike で確認したこと

OpenTUI 0.5.12 / Bun 1.4.2 / macOS arm64 で確認した。

- Markdown: 見出し・表・ネストしたリスト・引用・コードフェンスが描画される。タスクリストは `- [x]` のまま表示される
- 日本語の折り返し: 実端末では正しい
- 最初の描画まで 17ms（スクリプト開始から計測。Bun ランタイムの起動は含まない）
- `bun build --compile` の単一バイナリは 71MB

## 引き受ける制約

- **OpenTUI は 0.x**: 依存のバージョンを固定し、更新は単独の変更として行う
- **テスト用 renderer は全角文字を幅 1 として折り返す**: 日本語を含むレイアウトは snapshot で検証せず、実端末で確認する
- **Tree-sitter の文法は javascript / typescript / markdown / zig しか同梱されていない**: それ以外の言語はハイライトなしで表示する。文法を増やすには wasm と query を用意して `addDefaultParsers` で登録する
- **Tree-sitter は `$XDG_DATA_HOME/<appName>` にキャッシュを書く**: 起動時に `getDataPaths().appName = "rivu"` を設定する
- **Bun ランタイムを同梱するためバイナリが大きい**
