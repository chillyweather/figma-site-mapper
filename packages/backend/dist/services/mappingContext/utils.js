import fs from "fs";
export async function readJsonFile(filePath, fallback) {
    const content = await fs.promises.readFile(filePath, "utf8").catch(() => null);
    if (!content)
        return fallback;
    try {
        return JSON.parse(content);
    }
    catch {
        return fallback;
    }
}
