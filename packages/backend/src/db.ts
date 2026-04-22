import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import * as schema from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "sitemapper.db");
const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    screenshot_paths TEXT NOT NULL DEFAULT '[]',
    interactive_elements TEXT NOT NULL DEFAULT '[]',
    global_styles TEXT,
    last_crawled_at INTEGER,
    last_crawl_job_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(project_id, url)
  );

  CREATE INDEX IF NOT EXISTS pages_project_id_idx ON pages(project_id);

  CREATE TABLE IF NOT EXISTS elements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL REFERENCES pages(id),
    project_id INTEGER NOT NULL REFERENCES projects(id),
    type TEXT NOT NULL,
    selector TEXT,
    tag_name TEXT,
    element_id TEXT,
    classes TEXT NOT NULL DEFAULT '[]',
    bbox TEXT,
    href TEXT,
    text TEXT,
    styles TEXT NOT NULL DEFAULT '{}',
    style_tokens TEXT NOT NULL DEFAULT '[]',
    aria_label TEXT,
    role TEXT,
    value TEXT,
    placeholder TEXT,
    checked INTEGER,
    src TEXT,
    alt TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS elements_page_id_type_idx ON elements(page_id, type);
  CREATE INDEX IF NOT EXISTS elements_project_id_type_idx ON elements(project_id, type);
`);

export const db = drizzle(sqlite, { schema });

export async function connectDB(): Promise<void> {
  console.log(`✅ SQLite database ready at ${dbPath}`);
}

export default db;
