import { copyFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dist = resolve(root, "dist");

mkdirSync(dist, { recursive: true });

copyFileSync(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));
copyFileSync(resolve(root, "src/popup.html"), resolve(dist, "popup.html"));

console.log("Assets copied to dist/");
