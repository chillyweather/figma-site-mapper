import "../logger.js";
import { getWorkspaceStatus } from "../services/workspace/index.js";

async function main(): Promise<void> {
  const projectId = process.argv[2];
  if (!projectId) {
    process.stderr.write("Usage: pnpm --filter backend run inventory:status <projectId> [outPath]\n");
    process.exit(1);
  }

  try {
    const status = await getWorkspaceStatus(projectId, process.argv[3]);
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  }
}

main();
