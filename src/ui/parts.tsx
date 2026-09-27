import type { Segment } from "./format";
import { colors, toneColors } from "./theme";

export function Segments({
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
    <text wrapMode="none">
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

export function Field({ label, children }: { label: string; children: string }) {
  return (
    <text>
      <span fg={colors.muted}>{label.padEnd(10)}</span>
      {children}
    </text>
  );
}

export function Muted({ children }: { children: string }) {
  return <text fg={colors.muted}>{children}</text>;
}
