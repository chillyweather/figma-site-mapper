import "../logger.js";
import { refreshWorkspace } from "../services/workspace/index.js";

async function main(): Promise<void> {
  const projectId = process.argv[2];
  if (!projectId) {
    process.stderr.write("Usage: pnpm --filter backend run inventory:refresh <projectId> [outPath]\n");
    process.exit(1);
  }

  try {
    const result = await refreshWorkspace(projectId, {
      outPath: process.argv[3],
      verbose: process.argv.includes("--verbose"),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  }
}

main();
