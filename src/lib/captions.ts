import { CaptionCue, CaptionWord } from "../types";
import { normalizeWhitespace, splitSentences } from "./text";

function splitWords(value: string): string[] {
  return normalizeWhitespace(value).split(" ").filter(Boolean);
}

export function buildCaptionCues(script: string, durationSeconds: number): CaptionCue[] {
  const sentences = splitSentences(script);
  const chunks: string[] = [];

  for (const sentence of sentences) {
    const words = splitWords(sentence);
    if (words.length <= 7) {
      chunks.push(sentence);
      continue;
    }

    for (let index = 0; index < words.length; index += 6) {
      chunks.push(words.slice(index, index + 6).join(" "));
    }
  }

  const allWords = splitWords(script);
  const safeDuration = Math.max(durationSeconds, 1);
  const secondsPerWord = safeDuration / Math.max(allWords.length, 1);
  const cues: CaptionCue[] = [];
  let cursor = 0;

  for (const chunk of chunks) {
    const words = splitWords(chunk);
    const cueWords: CaptionWord[] = words.map((word) => ({
      text: word,
      durationSeconds: Math.max(0.16, secondsPerWord)
    }));
    const cueDuration = cueWords.reduce((sum, item) => sum + item.durationSeconds, 0);
    cues.push({
      startSeconds: cursor,
      endSeconds: Math.min(safeDuration, cursor + cueDuration),
      words: cueWords,
      plainText: words.join(" ")
    });
    cursor += cueDuration;
  }

  if (cues.length > 0) {
    cues[cues.length - 1].endSeconds = safeDuration;
  }

  return cues;
}

function formatAssTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function assEscape(value: string): string {
  return value.replace(/[{}]/g, "").replace(/\n/g, " ");
}

export function buildAssSubtitle(cues: CaptionCue[]): string {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Caption,DejaVu Sans,72,&H00FFFFFF,&H0000D7FF,&H00220D06,&H64000000,1,0,0,0,100,100,0,0,1,4,1,2,90,90,180,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text`;

  const lines = cues.map((cue) => {
    const karaoke = cue.words
      .map((word) => `{\\kf${Math.max(1, Math.round(word.durationSeconds * 100))}}${assEscape(word.text)}`)
      .join(" ");
    return `Dialogue: 0,${formatAssTime(cue.startSeconds)},${formatAssTime(
      cue.endSeconds
    )},Caption,,0,0,0,,${karaoke}`;
  });

  return `${header}\n${lines.join("\n")}\n`;
}
