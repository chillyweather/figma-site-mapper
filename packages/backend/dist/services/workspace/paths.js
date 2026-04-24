import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const backendRoot = path.resolve(__dirname, "../../..");
export const screenshotsRoot = path.join(backendRoot, "screenshots");
export const workspaceRoot = path.join(backendRoot, "workspace");
export function defaultWorkspacePath(projectId) {
    return path.join(workspaceRoot, projectId);
}
export function ensureDir(dirPath) {
    return fs.promises.mkdir(dirPath, { recursive: true }).then(() => undefined);
}
export function publicAssetUrlToLocalPath(value) {
    if (!value)
        return undefined;
    try {
        const parsed = new URL(value);
        if (!parsed.pathname.startsWith("/screenshots/"))
            return undefined;
        return path.join(screenshotsRoot, decodeURIComponent(parsed.pathname.replace("/screenshots/", "")));
    }
    catch {
        if (value.startsWith("/screenshots/")) {
            return path.join(screenshotsRoot, value.replace("/screenshots/", ""));
        }
        return path.isAbsolute(value) ? value : undefined;
    }
}
export function toPosixRelative(fromDir, targetPath) {
    return path.relative(fromDir, targetPath).split(path.sep).join("/");
}
export async function linkOrCopyFile(sourcePath, targetPath) {
    const sourceStat = await fs.promises.stat(sourcePath).catch(() => null);
    if (!sourceStat?.isFile())
        return false;
    await ensureDir(path.dirname(targetPath));
    await fs.promises.rm(targetPath, { force: true });
    if (process.platform !== "win32") {
        try {
            await fs.promises.symlink(sourcePath, targetPath);
            return true;
        }
        catch {
            // Fall through to copy. Symlinks may be unavailable in some environments.
        }
    }
    await fs.promises.copyFile(sourcePath, targetPath);
    return true;
}
export async function writeJson(filePath, value) {
    await ensureDir(path.dirname(filePath));
    await fs.promises.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
