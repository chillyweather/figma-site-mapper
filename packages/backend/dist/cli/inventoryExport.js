import "../logger.js";
import { exportDecisions } from "../services/workspace/index.js";
async function main() {
    const projectId = process.argv[2];
    if (!projectId) {
        process.stderr.write("Usage: pnpm --filter backend run inventory:export <projectId> [outPath]\n");
        process.exit(1);
    }
    try {
        const exportPath = await exportDecisions(projectId, process.argv[3]);
        process.stdout.write(`${JSON.stringify({ projectId, exportPath }, null, 2)}\n`);
    }
    catch (error) {
        process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
        process.exit(1);
    }
}
main();
