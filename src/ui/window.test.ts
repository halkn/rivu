import { expect, test } from "bun:test";
import { visibleWindow } from "./window";

const items = Array.from({ length: 10 }, (_, index) => index);

test("everything fits", () => {
  expect(visibleWindow(items.slice(0, 3), 1, 5)).toEqual([0, 1, 2]);
});

test("keeps the cursor in view, centered when possible", () => {
  expect(visibleWindow(items, 0, 4)).toEqual([0, 1, 2, 3]);
  expect(visibleWindow(items, 5, 4)).toEqual([3, 4, 5, 6]);
  expect(visibleWindow(items, 9, 4)).toEqual([6, 7, 8, 9]);
});
