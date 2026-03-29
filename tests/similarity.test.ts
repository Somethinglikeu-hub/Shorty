import { describe, expect, it } from "vitest";
import { findClosestMatch, jaccardSimilarity } from "../src/lib/similarity";

describe("similarity", () => {
  it("scores similar hooks higher than unrelated ones", () => {
    const close = jaccardSimilarity(
      "Her sabah ayni hatayi yapiyorsan sorun alarm degildir.",
      "Her sabah ayni hatayi tekrarliyorsan sorun alarm olmayabilir."
    );
    const far = jaccardSimilarity(
      "Her sabah ayni hatayi yapiyorsan sorun alarm degildir.",
      "Denizde guven kazanmak icin once dalga sesini dinlersin."
    );

    expect(close).toBeGreaterThan(far);
  });

  it("finds the closest historical match", () => {
    const result = findClosestMatch("Sessiz ozguven en guclu etkidir.", [
      "Sessiz ozguven bazen en yuksek sestir.",
      "Kahve yaparken acele etme."
    ]);

    expect(result.score).toBeGreaterThan(0);
    expect(result.text).toContain("Sessiz ozguven");
  });
});

