import { RGBA, SyntaxStyle } from "@opentui/core";

export const syntaxStyle = SyntaxStyle.fromStyles({
  keyword: { fg: RGBA.fromHex("#c792ea") },
  string: { fg: RGBA.fromHex("#c3e88d") },
  comment: { fg: RGBA.fromHex("#697098"), italic: true },
  number: { fg: RGBA.fromHex("#f78c6c") },
  function: { fg: RGBA.fromHex("#82aaff") },
  type: { fg: RGBA.fromHex("#ffcb6b") },
  "markup.heading": { fg: RGBA.fromHex("#82aaff"), bold: true },
  "markup.strong": { bold: true },
  "markup.italic": { italic: true },
  "markup.raw": { fg: RGBA.fromHex("#c3e88d") },
  "markup.link": { fg: RGBA.fromHex("#89ddff"), underline: true },
  "markup.list": { fg: RGBA.fromHex("#f78c6c") },
  default: { fg: RGBA.fromHex("#a6accd") },
});
