import { pathToFiletype, type ScrollBoxRenderable } from "@opentui/core";
import type { RefObject } from "react";
import type { Loadable, Preview } from "../work";
import { selectedFile, treeRows, type Browse } from "./browse";
import { Muted } from "./parts";
import { sanitize, sanitizeBlock } from "./sanitize";
import { syntaxStyle } from "./syntax";
import { colors, toneColors } from "./theme";
import { visibleWindow } from "./window";

function PreviewBody({ file, preview }: { file: string; preview: Loadable<Preview> }) {
  if (preview.status === "loading") return <Muted>loading…</Muted>;
  if (preview.status === "error")
    return <text fg={toneColors.danger}>{sanitize(preview.message)}</text>;
  const value = preview.value;
  switch (value.kind) {
    case "binary":
      return <Muted>binary file</Muted>;
    case "missing":
      return <Muted>deleted from the worktree</Muted>;
    case "symlink":
      return <Muted>{`symlink → ${sanitize(value.target)}`}</Muted>;
    case "text": {
      const content = sanitizeBlock(value.content);
      const filetype = pathToFiletype(file);
      return (
        <>
          {value.truncated ? <Muted>(showing the first 512KB)</Muted> : null}
          {filetype === "markdown" ? (
            <markdown content={content} syntaxStyle={syntaxStyle} width="100%" />
          ) : (
            <line-number
              fg={colors.muted}
              minWidth={4}
              paddingRight={1}
              showLineNumbers
              width="100%"
            >
              <code content={content} filetype={filetype} syntaxStyle={syntaxStyle} width="100%" />
            </line-number>
          )}
        </>
      );
    }
  }
}

export function FilesTab({
  browse,
  statuses,
  height,
  scrollRef,
}: {
  browse: Browse | null;
  /** Two-letter git status by path, for files with changes. */
  statuses: Map<string, string>;
  height: number;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
}) {
  if (!browse || browse.files.status === "loading") return <Muted>loading…</Muted>;
  if (browse.files.status === "error") {
    return <text fg={toneColors.danger}>{sanitize(browse.files.message)}</text>;
  }
  const rows = treeRows(browse);
  const index = rows.findIndex((row) => row.path === browse.cursor);
  const file = selectedFile(browse);
  return (
    <box flexDirection="row" flexGrow={1}>
      <box flexDirection="column" width="35%" paddingRight={1}>
        {visibleWindow(rows, index, height).map((row) => {
          const status = statuses.get(row.path)?.trim();
          const marker = row.kind === "dir" ? (row.open ? "▾ " : "▸ ") : "  ";
          return (
            <text
              key={row.path}
              bg={row.path === browse.cursor ? colors.selectedBackground : undefined}
            >
              {`${"  ".repeat(row.depth)}${marker}${sanitize(row.name)}`}
              {status ? <span fg={toneColors.warning}>{` ${status}`}</span> : null}
            </text>
          );
        })}
      </box>
      <scrollbox ref={scrollRef} flexGrow={1}>
        {file === null ? (
          <Muted>select a file</Muted>
        ) : (
          <PreviewBody
            file={file}
            preview={browse.preview?.file === file ? browse.preview.value : { status: "loading" }}
          />
        )}
      </scrollbox>
    </box>
  );
}
