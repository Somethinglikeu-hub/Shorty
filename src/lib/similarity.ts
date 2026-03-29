import { normalizeWhitespace } from "./text";

function tokenize(value: string): string[] {
  return normalizeWhitespace(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((part) => part.length > 2);
}

export function jaccardSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 && rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

export function findClosestMatch(
  source: string,
  candidates: string[]
): { score: number; text?: string } {
  let bestScore = 0;
  let bestText: string | undefined;

  for (const candidate of candidates) {
    const score = jaccardSimilarity(source, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestText = candidate;
    }
  }

  return { score: bestScore, text: bestText };
}

