import fs from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tempFile = `${filePath}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tempFile, filePath);
}

export function toRelativeUrl(baseDir: string, absolutePath: string): string {
  return path.relative(baseDir, absolutePath).split(path.sep).join("/");
}

