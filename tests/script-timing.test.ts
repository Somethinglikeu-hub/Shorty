import { describe, expect, it } from "vitest";
import { deriveScriptWordWindow } from "../src/lib/script-timing";

describe("deriveScriptWordWindow", () => {
  it("shrinks the target range when narration runs too long", () => {
    expect(deriveScriptWordWindow(90, 51.3)).toEqual({ min: 70, max: 78 });
  });

  it("expands the target range when narration runs too short", () => {
    expect(deriveScriptWordWindow(65, 30)).toEqual({ min: 78, max: 86 });
  });
});
