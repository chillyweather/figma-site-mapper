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

  CREATE TABLE IF NOT EXISTS project_mapping_inputs (
    project_id INTEGER PRIMARY KEY REFERENCES projects(id),
    repo_path TEXT,
    branch_name TEXT,
    storybook_url TEXT,
    storybook_path TEXT,
    ui_library TEXT,
    token_sources_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
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
    annotated_screenshot_path TEXT,
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
    parent_tag TEXT,
    parent_selector TEXT,
    ancestry_path TEXT,
    nearest_interactive_selector TEXT,
    is_visible INTEGER,
    region_label TEXT,
    style_signature TEXT,
    component_fingerprint TEXT,
    parent_fingerprint TEXT,
    child_count INTEGER DEFAULT 0,
    crop_path TEXT,
    crop_context_path TEXT,
    crop_error TEXT,
    is_global_chrome INTEGER DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS crawl_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    job_id TEXT,
    start_url TEXT NOT NULL,
    settings_json TEXT NOT NULL DEFAULT '{}',
    page_ids_json TEXT NOT NULL DEFAULT '[]',
    page_count INTEGER NOT NULL DEFAULT 0,
    element_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    started_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS inventory_builds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    crawl_run_id INTEGER,
    workspace_path TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 0,
    element_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    started_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS discovery_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    start_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    settings_json TEXT NOT NULL DEFAULT '{}',
    candidate_count INTEGER NOT NULL DEFAULT 0,
    recommended_count INTEGER NOT NULL DEFAULT 0,
    approved_count INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS discovery_candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discovery_run_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    host TEXT NOT NULL,
    path TEXT NOT NULL,
    source TEXT NOT NULL,
    source_url TEXT,
    page_type TEXT NOT NULL,
    pattern_key TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    reasons_json TEXT NOT NULL DEFAULT '[]',
    depth INTEGER,
    is_recommended INTEGER NOT NULL DEFAULT 0,
    is_approved INTEGER NOT NULL DEFAULT 0,
    is_excluded INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS flows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS flow_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flow_id INTEGER NOT NULL REFERENCES flows(id),
    step_index INTEGER NOT NULL,
    source_page_id INTEGER NOT NULL REFERENCES pages(id),
    source_url TEXT NOT NULL,
    element_id INTEGER,
    element_selector TEXT,
    element_text TEXT,
    element_bbox_json TEXT,
    target_url TEXT,
    target_page_id INTEGER,
    action_kind TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS flows_project_id_idx ON flows(project_id);
  CREATE INDEX IF NOT EXISTS flow_steps_flow_id_idx ON flow_steps(flow_id);

  CREATE UNIQUE INDEX IF NOT EXISTS discovery_candidates_run_norm_idx
    ON discovery_candidates(discovery_run_id, normalized_url);

  CREATE INDEX IF NOT EXISTS discovery_candidates_project_norm_idx
    ON discovery_candidates(project_id, normalized_url);

  CREATE INDEX IF NOT EXISTS discovery_candidates_run_type_idx
    ON discovery_candidates(discovery_run_id, page_type);

  CREATE INDEX IF NOT EXISTS discovery_candidates_run_recommended_idx
    ON discovery_candidates(discovery_run_id, is_recommended);
`);

function ensureColumn(tableName: string, columnName: string, columnDefinition: string): void {
  const columns = sqlite
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
}

ensureColumn("elements", "parent_tag", "parent_tag TEXT");
ensureColumn("elements", "parent_selector", "parent_selector TEXT");
ensureColumn("elements", "ancestry_path", "ancestry_path TEXT");
ensureColumn(
  "elements",
  "nearest_interactive_selector",
  "nearest_interactive_selector TEXT"
);
ensureColumn("elements", "is_visible", "is_visible INTEGER");
ensureColumn("elements", "region_label", "region_label TEXT");
ensureColumn("elements", "style_signature", "style_signature TEXT");
ensureColumn("elements", "component_fingerprint", "component_fingerprint TEXT");
ensureColumn("elements", "parent_fingerprint", "parent_fingerprint TEXT");
ensureColumn("elements", "child_count", "child_count INTEGER DEFAULT 0");
ensureColumn("elements", "crop_path", "crop_path TEXT");
ensureColumn("elements", "crop_context_path", "crop_context_path TEXT");
ensureColumn("elements", "crop_error", "crop_error TEXT");
ensureColumn("elements", "is_global_chrome", "is_global_chrome INTEGER DEFAULT 0");
ensureColumn("pages", "annotated_screenshot_path", "annotated_screenshot_path TEXT");
ensureColumn("pages", "last_crawl_run_id", "last_crawl_run_id INTEGER");
ensureColumn("crawl_runs", "discovery_run_id", "discovery_run_id INTEGER");
ensureColumn("crawl_runs", "approved_urls_json", "approved_urls_json TEXT");
ensureColumn("discovery_runs", "warnings_json", "warnings_json TEXT NOT NULL DEFAULT '[]'");
ensureColumn("discovery_candidates", "depth", "depth INTEGER");

export const db = drizzle(sqlite, { schema });

export async function connectDB(): Promise<void> {
  console.log(`✅ SQLite database ready at ${dbPath}`);
}

export default db;
