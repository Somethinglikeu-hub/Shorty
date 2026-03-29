import { describe, expect, it } from "vitest";
import { buildAssSubtitle, buildCaptionCues } from "../src/lib/captions";

describe("captions", () => {
  it("builds karaoke cues from script duration", () => {
    const cues = buildCaptionCues(
      "Bir sabah gec kaldiginda aslinda tum gunu degil sadece ilk karari kaybedersin. Ama ikinci karar hala senin elindedir.",
      38
    );

    expect(cues.length).toBeGreaterThan(1);
    expect(cues[0].words.length).toBeLessThanOrEqual(6);
    expect(cues.at(-1)?.endSeconds).toBe(38);
  });

  it("creates ass subtitles with karaoke timing", () => {
    const cues = buildCaptionCues("Kisa hikayeler daha iyi hatirlanir.", 12);
    const ass = buildAssSubtitle(cues);

    expect(ass).toContain("[Events]");
    expect(ass).toContain("\\kf");
  });
});

