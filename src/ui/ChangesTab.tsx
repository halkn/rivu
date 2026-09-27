import type { ChangeRow } from "./format";
import { Muted } from "./parts";
import { sanitize } from "./sanitize";
import { colors, toneColors } from "./theme";
import { visibleWindow } from "./window";

function statusColor(status: string): string {
  if (status === "??") return toneColors.accent;
  if (status === "UU") return toneColors.danger;
  return toneColors.warning;
}

function lines(row: ChangeRow): string {
  if (row.status === "??") return "new";
  if (row.binary) return "binary";
  if (row.added === null || row.deleted === null) return "";
  return `+${row.added} −${row.deleted}`;
}

export function ChangesTab({
  rows,
  index,
  height,
}: {
  rows: ChangeRow[];
  index: number;
  height: number;
}) {
  if (rows.length === 0) return <Muted>no changes</Muted>;
  const selected = rows[Math.min(index, rows.length - 1)];
  return (
    <box flexDirection="column">
      {visibleWindow(rows, index, height).map((row) => (
        <text key={row.path} bg={row === selected ? colors.selectedBackground : undefined}>
          <span fg={statusColor(row.status)}>{`${row.status} `}</span>
          {sanitize(row.path)}
          <span fg={colors.muted}>{`  ${lines(row)}`}</span>
        </text>
      ))}
    </box>
  );
}
