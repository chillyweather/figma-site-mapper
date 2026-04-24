import "../logger.js";
import { buildWorkspace } from "../services/workspace/index.js";
function parseArgs(argv) {
    const args = [...argv];
    const result = {
        verbose: false,
    };
    while (args.length > 0) {
        const arg = args.shift();
        if (!arg)
            continue;
        if (arg === "--verbose") {
            result.verbose = true;
            continue;
        }
        if (arg === "--out") {
            result.outPath = args.shift();
            continue;
        }
        if (arg === "--incremental") {
            process.stderr.write("--incremental is reserved for a later phase; doing a full rebuild.\n");
            continue;
        }
        if (!result.projectId) {
            result.projectId = arg;
        }
    }
    return result;
}
async function main() {
    const { projectId, outPath, verbose } = parseArgs(process.argv.slice(2));
    if (!projectId) {
        process.stderr.write("Usage: pnpm --filter backend run inventory:prepare <projectId> [--out <path>] [--verbose]\n");
        process.exit(1);
    }
    try {
        const result = await buildWorkspace(projectId, { outPath, verbose });
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
    catch (error) {
        if (error instanceof Error && error.name === "ProjectNotFound") {
            process.stderr.write(`${error.message}\n`);
            process.exit(2);
        }
        process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
        process.exit(1);
    }
}
main();
