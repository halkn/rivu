import { expect, test } from "bun:test";
import { sanitize, sanitizeBlock } from "./sanitize";

test("removes escape sequences and control characters", () => {
  expect(sanitize("fix\x1b]52;c;ZXZpbA==\x07 title")).toBe("fix]52;c;ZXZpbA== title");
  expect(sanitize("a\x1b[2Jb\x9bc\x7fd")).toBe("a[2Jbcd");
});

test("turns line breaks and tabs into spaces", () => {
  expect(sanitize("dir/new\nline\tname")).toBe("dir/new line name");
});

test("keeps printable unicode", () => {
  expect(sanitize("日本語 ✅ café")).toBe("日本語 ✅ café");
});

test("sanitizeBlock keeps line breaks and tabs but drops other controls", () => {
  expect(sanitizeBlock("a\r\n\tb\x1b[31mc\x07\n")).toBe("a\n\tb[31mc\n");
});
