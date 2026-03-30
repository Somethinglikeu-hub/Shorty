import { describe, expect, it, vi, afterEach } from "vitest";
import { config, type AppConfig } from "../src/config";
import { GeminiClient } from "../src/services/gemini-client";
import { ShortyError } from "../src/lib/errors";
import type { StoryPlan } from "../src/types";

function buildConfig(): AppConfig {
  return {
    ...config,
    geminiApiKey: "test-key",
    geminiTextModel: "test-model",
    geminiTtsModel: "test-tts-model"
  };
}

function buildPayload(plan: StoryPlan) {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: JSON.stringify(plan) }]
        }
      }
    ]
  };
}

describe("GeminiClient.generateStoryPlan", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("retries when Gemini returns a script that is too short", async () => {
    const shortPlan: StoryPlan = {
      topic: "Kisa konu",
      hook: "Bugun cok kisa bir hikaye anlatiyorum.",
      beats: ["Ilk beat", "Ikinci beat", "Ucuncu beat"],
      outro: "Bitti.",
      fullScript: "Bugun kisa bir sey anlatiyorum ve hemen bitiriyorum.",
      title: "Kisa plan",
      description: "Kisa aciklama",
      hashtags: ["#kisa", "#test"],
      visualQueries: ["city street", "person walking", "sunrise"],
      shortSummary: "Kisa"
    };

    const validPlan: StoryPlan = {
      topic: "Direnc",
      hook: "Bir sabah, herkes vazgecmeni beklerken sen sadece bir adim daha attin.",
      beats: [
        "Ilk adimda sonuc gelmedi ama ritmini bozmadin ve her gun ayni saatte yeniden denedin.",
        "Ikinci haftada degisen sey motivasyonun degil disiplinin oldu; artik bahane degil tekrar vardi.",
        "Ucuncu kisimda insanlar sonucu gordu ama kimse o sessiz tekrarlarin seni nasil tasidigini bilmiyordu."
      ],
      outro: "Bazen buyuk farki yaratan sey yetenek degil, kimsenin gormedigi o son tekrar olur.",
      fullScript:
        "Bir sabah, herkes vazgecmeni beklerken sen sadece bir adim daha attin. Ilk denemede sonuc gelmedi ama ritmini bozmadin. Her gun ayni saatte geri dondun ve bahaneyi sessizce kapinin disinda biraktin. Ikinci haftada degisen sey motivasyonun degil disiplinin oldu. Artik nasil hissettigin degil, tekrar edip etmedigin onemliydi. Bir sure sonra insanlar sonucu gormeye basladi ama kimse seni tasiyan o sakin tekrarlarin agirligini bilmiyordu. Yoruldugun gunlerde bile sadece bugunun tekrarini dusundun, cunku buyuk sonuc yerine kucuk istikrarin seni daha uzağa tasiyacagini ogrendin. Bazen hayati degistiren sey tek bir buyuk firsat degil, kimsenin alkislamadigi o son tekrar olur.",
      title: "Kimsenin Gormedigi Son Tekrar",
      description: "Disiplin bazen motivasyondan daha sessizdir ama daha uzun tasir.",
      hashtags: ["#motivasyon", "#disiplin", "#shorts"],
      visualQueries: ["runner at dawn", "empty gym", "city sunrise", "close up hands"],
      shortSummary: "Disiplinin gorunmeyen gucu"
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => buildPayload(shortPlan)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => buildPayload(validPlan)
      });

    vi.stubGlobal("fetch", fetchMock);

    const client = new GeminiClient(buildConfig());
    const plan = await client.generateStoryPlan(undefined, []);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(plan.title).toBe(validPlan.title);
    expect(plan.visualQueries).toHaveLength(4);
  });

  it("fails after exhausting retries", async () => {
    const shortPlan: StoryPlan = {
      topic: "Kisa konu",
      hook: "Kisa hook",
      beats: ["Bir", "Iki", "Uc"],
      outro: "Son",
      fullScript: "Bu metin cok kisa kaldi.",
      title: "Kisa plan",
      description: "Kisa aciklama",
      hashtags: ["#kisa"],
      visualQueries: ["street", "night", "rain"],
      shortSummary: "Kisa"
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => buildPayload(shortPlan)
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new GeminiClient(buildConfig());

    await expect(client.generateStoryPlan(undefined, [])).rejects.toBeInstanceOf(ShortyError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
