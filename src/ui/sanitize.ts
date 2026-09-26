// Strings from Git (paths, commit subjects) are untrusted; C0/C1 controls could drive the terminal.
export function sanitize(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\t\n\r]/g, " ").replace(/[\x00-\x1f\x7f-\x9f]/g, "");
}
