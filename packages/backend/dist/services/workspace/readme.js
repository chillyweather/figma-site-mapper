import path from "path";
import { ensureDir } from "./paths.js";
export async function writeWorkspaceReadme(workspacePath, data, generatedAt) {
    const content = `# DS Inventory Workspace - ${data.project.name}

- Project ID: ${data.project.id}
- Pages: ${data.pages.length}
- Elements: ${data.elements.length}
- Last built: ${generatedAt}

## Layout

- \`project.json\` - project summary.
- \`pages/<pageId>/\` - page manifests, screenshots, annotated screenshots, and compact elements.
- \`catalog/<category>/\` - fingerprint-grouped element catalogs and contact sheets.
- \`tokens/\` - raw token frequency tables plus swatches/specimens.
- \`regions/\` - region coverage and global chrome hints.
- \`mapping-context/\` - optional evidence-input scaffold for repo, Storybook, library, and token-source backed mapping.
- \`decisions/\` - agent-owned output. This folder is preserved on rebuild.

## Suggested Agent Workflow

1. Read \`project.json\`.
2. Review a few \`pages/*/screenshot-annotated.png\` files.
3. Inspect \`catalog/*/contact-sheet.png\` and \`groups.json\`.
4. Review \`tokens/colors-swatches.png\`, \`tokens/colors.json\`, and typography files.
5. Review \`mapping-context/profile.json\` and any optional evidence summaries.
6. Write decisions into \`decisions/\`.

Do not edit generated folders directly. Rebuilds overwrite everything except \`decisions/\`.
`;
    await ensureDir(workspacePath);
    await import("fs").then((fs) => fs.promises.writeFile(path.join(workspacePath, "README.md"), content, "utf8"));
}
