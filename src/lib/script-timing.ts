export interface ScriptWordWindow {
  min: number;
  max: number;
}

export function deriveScriptWordWindow(currentWords: number, durationSeconds: number): ScriptWordWindow {
  const safeWords = Math.max(1, Math.round(currentWords));
  const safeDuration = Math.max(durationSeconds, 1);
  const targetDuration = safeDuration > 45 ? 42 : 38;
  const center = Math.round((safeWords * targetDuration) / safeDuration);
  const clampedCenter = Math.max(60, Math.min(92, center));
  const min = Math.max(60, clampedCenter - 4);
  const max = Math.min(96, Math.max(min + 4, clampedCenter + 4));

  return { min, max };
}
