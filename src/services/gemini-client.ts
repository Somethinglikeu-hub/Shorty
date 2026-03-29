import fs from "node:fs/promises";
import path from "node:path";
import { AppConfig } from "../config";
import { ShortyError } from "../lib/errors";
import { countWords, normalizeWhitespace, truncate } from "../lib/text";
import { StoryPlan, StoryReview } from "../types";

function clampHashtags(hashtags: string[]): string[] {
  return hashtags
    .map((tag) => tag.trim().replace(/^#+/, ""))
    .filter(Boolean)
    .slice(0, 5)
    .map((tag) => `#${tag}`);
}

function normalizePlan(plan: StoryPlan): StoryPlan {
  const beats = Array.isArray(plan.beats) ? plan.beats.map((item) => normalizeWhitespace(item)).filter(Boolean) : [];
  const visualQueries = Array.isArray(plan.visualQueries)
    ? plan.visualQueries.map((item) => normalizeWhitespace(item)).filter(Boolean).slice(0, 6)
    : [];

  const normalized: StoryPlan = {
    topic: normalizeWhitespace(plan.topic),
    hook: normalizeWhitespace(plan.hook),
    beats: beats.slice(0, 3),
    outro: normalizeWhitespace(plan.outro),
    fullScript: normalizeWhitespace(plan.fullScript),
    title: truncate(normalizeWhitespace(plan.title), 95),
    description: truncate(normalizeWhitespace(plan.description), 4000),
    hashtags: clampHashtags(plan.hashtags ?? []),
    visualQueries,
    shortSummary: normalizeWhitespace(plan.shortSummary)
  };

  if (normalized.beats.length !== 3) {
    throw new ShortyError("writing", "AI tam olarak 3 beat uretmedi.", true);
  }

  if (!normalized.fullScript || countWords(normalized.fullScript) < 90) {
    throw new ShortyError("writing", "AI yeterince uzun bir script uretmedi.", true);
  }

  if (normalized.visualQueries.length < 3) {
    throw new ShortyError("sourcing", "AI yeterli gorsel arama terimi uretmedi.", true);
  }

  return normalized;
}

function encodeWav(pcmData: Uint8Array, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmData.length, 40);

  return Buffer.concat([header, Buffer.from(pcmData)]);
}

export class GeminiClient {
  constructor(private readonly config: AppConfig) {}

  private ensureConfigured(step: "writing" | "voicing"): void {
    if (!this.config.geminiApiKey) {
      throw new ShortyError(step, "GEMINI_API_KEY eksik. .env dosyasini doldurman gerekiyor.", true);
    }
  }

  private async callJsonModel<T>(systemInstruction: string, userPrompt: string): Promise<T> {
    this.ensureConfigured("writing");
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.geminiTextModel}:generateContent?key=${this.config.geminiApiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          {
            parts: [{ text: userPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.85,
          responseMimeType: "application/json"
        }
      })
    });

    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new ShortyError("writing", "Gemini metin cagrisi basarisiz oldu.", true, JSON.stringify(payload));
    }

    const text = (((payload.candidates as Array<Record<string, unknown>> | undefined)?.[0]?.content as Record<
      string,
      unknown
    > | undefined)?.parts as Array<Record<string, unknown>> | undefined)
      ?.map((part) => String(part.text ?? ""))
      .join("")
      .trim();

    if (!text) {
      throw new ShortyError("writing", "Gemini bos JSON cevabi dondurdu.", true);
    }

    return JSON.parse(text) as T;
  }

  async generateStoryPlan(seedTopic: string | undefined, history: string[], rejectionNotes?: string): Promise<StoryPlan> {
    const systemInstruction = `Sen YouTube Shorts icin yalnizca Turkce motivasyon/hikaye videolari tasarlayan bir icerik stratejistisin.
Her zaman su kurallara uy:
- Yalnizca gecerli JSON dondur.
- Script 95-120 kelime araliginda olsun.
- Yapi hook + 3 beat + kapanis olsun.
- Klise ve jenerik motivasyon laflarindan kac.
- Yeni ve farkli bir konu sec.
- Hashtagleri # ile dondur.
- visualQueries alanini Ingilizce ve Pexels'ta aranabilir sekilde dondur.
- Baslik merak uyandirsin ama clickbait olmasin.`;

    const userPrompt = `Bugun icin yeni bir Shorts fikri uret.
Istege bagli seed topic: ${seedTopic || "yok, tamamen yeni konu bul"}.
Son 50 isten yakin gecmis: ${history.length ? history.join(" | ") : "yok"}.
Reddedilme notlari: ${rejectionNotes || "yok"}.

Su semayi JSON olarak dondur:
{
  "topic": "string",
  "hook": "string",
  "beats": ["string", "string", "string"],
  "outro": "string",
  "fullScript": "string",
  "title": "string",
  "description": "string",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "visualQueries": ["english query 1", "english query 2", "english query 3", "english query 4"],
  "shortSummary": "string"
}`;

    const rawPlan = await this.callJsonModel<StoryPlan>(systemInstruction, userPrompt);
    return normalizePlan(rawPlan);
  }

  async reviewStoryPlan(plan: StoryPlan, history: string[]): Promise<StoryReview> {
    const systemInstruction = `Sen otomasyon pipeline'i icin ikinci bir editor gibi davran.
Yalnizca JSON dondur.
similarityScore 0 ile 1 arasinda olsun.
clicheScore 0 ile 100 arasinda olsun.
accepted yalnizca script yayinlanabilir kaliteye ulasiyorsa true olsun.`;

    const userPrompt = `Asagidaki icerigi degerlendir:
Plan: ${JSON.stringify(plan)}
Gecmis: ${history.length ? history.join(" | ") : "yok"}

Su JSON semasini kullan:
{
  "accepted": true,
  "clicheScore": 12,
  "similarityScore": 0.18,
  "notes": "string",
  "revisedPlan": {
    "hook": "optional string",
    "beats": ["optional", "optional", "optional"],
    "outro": "optional string",
    "fullScript": "optional string",
    "title": "optional string",
    "description": "optional string",
    "hashtags": ["#optional"],
    "visualQueries": ["optional english query"]
  }
}`;

    const review = await this.callJsonModel<StoryReview>(systemInstruction, userPrompt);
    return {
      accepted: Boolean(review.accepted),
      clicheScore: Number(review.clicheScore ?? 0),
      similarityScore: Number(review.similarityScore ?? 0),
      notes: normalizeWhitespace(review.notes ?? ""),
      revisedPlan: review.revisedPlan
    };
  }

  async generateSpeech(script: string, outputPath: string, voiceName: string, stylePrompt: string): Promise<void> {
    this.ensureConfigured("voicing");
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.geminiTtsModel}:generateContent?key=${this.config.geminiApiKey}`;
    const prompt = `${stylePrompt}\n\nMetni Turkce olarak aynen oku:\n${script}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.config.geminiTtsModel,
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName
              }
            }
          }
        }
      })
    });

    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new ShortyError("voicing", "Gemini TTS cagrisi basarisiz oldu.", true, JSON.stringify(payload));
    }

    const audioData = ((((payload.candidates as Array<Record<string, unknown>> | undefined)?.[0]?.content as Record<
      string,
      unknown
    > | undefined)?.parts as Array<Record<string, unknown>> | undefined)?.[0]?.inlineData as Record<string, unknown> | undefined)
      ?.data;

    if (!audioData || typeof audioData !== "string") {
      throw new ShortyError("voicing", "Gemini TTS ses verisi dondurmedi.", true);
    }

    const pcmBuffer = Buffer.from(audioData, "base64");
    const wavBuffer = encodeWav(pcmBuffer);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, wavBuffer);
  }
}
