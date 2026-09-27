import type { Tone } from "./format";

export const colors = {
  muted: "#697098",
  selectedBackground: "#2f3449",
} as const;

export const toneColors: Record<Tone, string> = {
  success: "#c3e88d",
  warning: "#ffcb6b",
  danger: "#f07178",
  accent: "#82aaff",
  muted: colors.muted,
};
