import fs from "fs";

export async function readJsonFile<T>(
  filePath: string,
  fallback: T
): Promise<T> {
  const content = await fs.promises.readFile(filePath, "utf8").catch(() => null);
  if (!content) return fallback;
  try {
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}
