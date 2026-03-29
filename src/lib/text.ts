export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function countWords(value: string): number {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return 0;
  }
  return normalized.split(" ").length;
}

export function slugify(value: string): string {
  return normalizeWhitespace(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function splitSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
}

