import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
const IGNORED_DIRS = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".next",
    ".turbo",
    ".cache",
    "out",
]);
const WORKSPACE_FILE_CANDIDATES = [
    "pnpm-workspace.yaml",
    "turbo.json",
    "package.json",
    "yarn.lock",
    "package-lock.json",
];
const COMPONENT_DIR_CANDIDATES = [
    "src/components",
    "components",
    "app/components",
    "src/ui",
    "ui",
    "src/lib/ui",
    "lib/ui",
    "src/js/components",
    "src/js/legacy/components",
    "src/js/blocks",
    "src/js/preacts/blocks",
    "src/scss/components",
    "src/scss/blocks",
    "template-parts",
    "blocks",
    "src/blocks",
    "modules",
    "src/modules",
];
const APP_DIR_CANDIDATES = [
    "app",
    "src/app",
    "pages",
    "src/pages",
    "routes",
    "src/routes",
    "src/scss/pages",
    "templates",
    "views",
    "patterns",
    "page-templates",
    "web/app",
    "web/app/themes",
    "web/app/themes/atera",
    "wp-content/themes",
];
const TOKEN_FILE_PATTERNS = [
    /^tailwind\.config\.(js|cjs|mjs|ts)$/,
    /tokens?\.(css|scss|js|ts|json)$/i,
    /theme\.(css|scss|js|ts|json)$/i,
];
function relativeToRepo(repoPath, targetPath) {
    const relative = path.relative(repoPath, targetPath).split(path.sep).join("/");
    return relative.length > 0 ? relative : ".";
}
function uniqueSorted(values) {
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
function isDir(filePath) {
    return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
}
function isFile(filePath) {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}
function runGit(repoPath, args) {
    try {
        return execFileSync("git", ["-C", repoPath, ...args], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    }
    catch {
        return null;
    }
}
function firstNonEmptyLine(value) {
    if (!value)
        return null;
    for (const line of value.split("\n")) {
        const trimmed = line.trim();
        if (trimmed)
            return trimmed;
    }
    return null;
}
function resolveRequestedBranchRef(repoPath, requestedBranch) {
    if (!requestedBranch)
        return null;
    const localRef = runGit(repoPath, ["show-ref", "--verify", "--hash", `refs/heads/${requestedBranch}`]);
    if (localRef)
        return `refs/heads/${requestedBranch}`;
    const remoteRef = firstNonEmptyLine(runGit(repoPath, ["for-each-ref", "--format=%(refname)", `refs/remotes/*/${requestedBranch}`]));
    return remoteRef;
}
function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    catch {
        return null;
    }
}
function walkFiles(rootPath, maxDepth) {
    const results = [];
    function visit(currentPath, depth) {
        if (depth > maxDepth)
            return;
        let entries;
        try {
            entries = fs.readdirSync(currentPath, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (IGNORED_DIRS.has(entry.name))
                    continue;
                visit(path.join(currentPath, entry.name), depth + 1);
                continue;
            }
            if (entry.isFile()) {
                results.push(path.join(currentPath, entry.name));
            }
        }
    }
    visit(rootPath, 0);
    return results;
}
function detectPackageManager(repoPath) {
    if (isFile(path.join(repoPath, "pnpm-workspace.yaml")))
        return "pnpm";
    if (isFile(path.join(repoPath, "yarn.lock")))
        return "yarn";
    if (isFile(path.join(repoPath, "package-lock.json")))
        return "npm";
    return isFile(path.join(repoPath, "package.json")) ? "npm-like" : null;
}
function detectUiLibraries(packageJsonFiles) {
    const detected = new Set();
    for (const filePath of packageJsonFiles) {
        const parsed = readJson(filePath);
        if (!parsed)
            continue;
        const deps = {
            ...(typeof parsed.dependencies === "object" && parsed.dependencies ? parsed.dependencies : {}),
            ...(typeof parsed.devDependencies === "object" && parsed.devDependencies ? parsed.devDependencies : {}),
            ...(typeof parsed.peerDependencies === "object" && parsed.peerDependencies ? parsed.peerDependencies : {}),
        };
        const names = Object.keys(deps);
        if (names.some((name) => name === "@mui/material" || name.startsWith("@mui/")))
            detected.add("MUI");
        if (names.includes("antd"))
            detected.add("Ant Design");
        if (names.includes("@chakra-ui/react"))
            detected.add("Chakra UI");
        if (names.includes("tailwindcss"))
            detected.add("Tailwind CSS");
        if (names.some((name) => name.startsWith("@radix-ui/")))
            detected.add("Radix UI");
        if (names.includes("bootstrap"))
            detected.add("Bootstrap");
    }
    return Array.from(detected).sort((a, b) => a.localeCompare(b));
}
function detectRoots(repoPath, packageRoots) {
    const appRoots = [];
    const componentRoots = [];
    const routeRoots = [];
    const candidateBases = uniqueSorted([".", ...packageRoots]);
    for (const relativeBase of candidateBases) {
        const basePath = relativeBase === "." ? repoPath : path.join(repoPath, relativeBase);
        for (const candidate of COMPONENT_DIR_CANDIDATES) {
            const fullPath = path.join(basePath, candidate);
            if (isDir(fullPath)) {
                componentRoots.push(relativeToRepo(repoPath, fullPath));
            }
        }
        for (const candidate of APP_DIR_CANDIDATES) {
            const fullPath = path.join(basePath, candidate);
            if (isDir(fullPath)) {
                const relative = relativeToRepo(repoPath, fullPath);
                appRoots.push(relative);
                routeRoots.push(relative);
            }
        }
    }
    return {
        appRoots: uniqueSorted(appRoots),
        componentRoots: uniqueSorted(componentRoots),
        routeRoots: uniqueSorted(routeRoots),
    };
}
function detectTokenSources(repoPath, packageJsonFiles, configuredTokenSources) {
    const detected = new Set();
    for (const source of configuredTokenSources) {
        if (!source)
            continue;
        if (path.isAbsolute(source) && source.startsWith(repoPath)) {
            detected.add(relativeToRepo(repoPath, source));
        }
        else {
            detected.add(source);
        }
    }
    const parentDirs = uniqueSorted(packageJsonFiles.map((filePath) => relativeToRepo(repoPath, path.dirname(filePath))));
    const scanRoots = uniqueSorted([".", ...parentDirs]);
    for (const relativeRoot of scanRoots) {
        const rootPath = relativeRoot === "." ? repoPath : path.join(repoPath, relativeRoot);
        const files = walkFiles(rootPath, 3);
        for (const filePath of files) {
            const basename = path.basename(filePath);
            if (TOKEN_FILE_PATTERNS.some((pattern) => pattern.test(basename))) {
                detected.add(relativeToRepo(repoPath, filePath));
            }
        }
    }
    return Array.from(detected).sort((a, b) => a.localeCompare(b));
}
function detectStorybook(repoPath) {
    const roots = [];
    const files = walkFiles(repoPath, 4);
    for (const filePath of files) {
        const relative = relativeToRepo(repoPath, filePath);
        if (relative.includes("/.storybook/") || relative.startsWith(".storybook/")) {
            const storybookRoot = relative.split("/.storybook/")[0];
            roots.push(storybookRoot ? `${storybookRoot}/.storybook` : ".storybook");
            continue;
        }
        if (/\.stories\.(t|j)sx?$/i.test(relative)) {
            roots.push(path.dirname(relative));
        }
    }
    const uniqueRoots = uniqueSorted(roots);
    return {
        detected: uniqueRoots.length > 0,
        roots: uniqueRoots,
    };
}
function sampleComponentFiles(repoPath, componentRoots) {
    const samples = [];
    for (const relativeRoot of componentRoots) {
        const rootPath = relativeRoot === "." ? repoPath : path.join(repoPath, relativeRoot);
        const files = walkFiles(rootPath, 2)
            .filter((filePath) => /\.(php|css|scss|(t|j)sx?)$/i.test(filePath))
            .map((filePath) => relativeToRepo(repoPath, filePath))
            .slice(0, 5);
        samples.push(...files);
        if (samples.length >= 12)
            break;
    }
    return uniqueSorted(samples).slice(0, 12);
}
export async function analyzeRepoMappingInput(repoPathInput, requestedBranchInput, generatedAt, configuredTokenSources) {
    const repoPath = repoPathInput.trim();
    const requestedBranch = requestedBranchInput.trim();
    if (!repoPath) {
        const repoIndex = {
            generatedAt,
            status: "not-configured",
            repoPath: null,
            requestedBranch: requestedBranch || null,
            requestedBranchRef: null,
            resolvedBranch: null,
            resolvedHeadRef: null,
            commitSha: null,
            packageManager: null,
            workspaceFiles: [],
            packageRoots: [],
            appRoots: [],
            componentRoots: [],
            routeRoots: [],
            tokenSources: [],
            storybookDetected: false,
            storybookRoots: [],
            uiLibraryCandidates: [],
            componentFileSamples: [],
            notes: [],
        };
        return {
            repo: {
                path: null,
                requestedBranch: requestedBranch || null,
                requestedBranchRef: null,
                resolvedBranch: null,
                resolvedHeadRef: null,
                commitSha: null,
                status: "not-configured",
            },
            repoIndex,
            evidenceSummary: {
                status: "not-configured",
                packageRoots: [],
                componentRoots: [],
                routeRoots: [],
                tokenSources: [],
                storybookDetected: false,
                uiLibraryCandidates: [],
            },
            logLines: ["- Repo adapter skipped: repo path not configured."],
        };
    }
    if (!isDir(repoPath)) {
        const repoIndex = {
            generatedAt,
            status: "missing-path",
            repoPath,
            requestedBranch: requestedBranch || null,
            requestedBranchRef: null,
            resolvedBranch: null,
            resolvedHeadRef: null,
            commitSha: null,
            packageManager: null,
            workspaceFiles: [],
            packageRoots: [],
            appRoots: [],
            componentRoots: [],
            routeRoots: [],
            tokenSources: configuredTokenSources,
            storybookDetected: false,
            storybookRoots: [],
            uiLibraryCandidates: [],
            componentFileSamples: [],
            notes: ["Configured repo path does not exist or is not a directory."],
        };
        return {
            repo: {
                path: repoPath,
                requestedBranch: requestedBranch || null,
                requestedBranchRef: null,
                resolvedBranch: null,
                resolvedHeadRef: null,
                commitSha: null,
                status: "missing-path",
            },
            repoIndex,
            evidenceSummary: {
                status: "missing-path",
                packageRoots: [],
                componentRoots: [],
                routeRoots: [],
                tokenSources: configuredTokenSources,
                storybookDetected: false,
                uiLibraryCandidates: [],
            },
            logLines: ["- Repo adapter failed: configured repo path does not exist."],
        };
    }
    const insideWorkTree = runGit(repoPath, ["rev-parse", "--is-inside-work-tree"]);
    if (insideWorkTree !== "true") {
        const repoIndex = {
            generatedAt,
            status: "not-git",
            repoPath,
            requestedBranch: requestedBranch || null,
            requestedBranchRef: null,
            resolvedBranch: null,
            resolvedHeadRef: null,
            commitSha: null,
            packageManager: null,
            workspaceFiles: [],
            packageRoots: [],
            appRoots: [],
            componentRoots: [],
            routeRoots: [],
            tokenSources: configuredTokenSources,
            storybookDetected: false,
            storybookRoots: [],
            uiLibraryCandidates: [],
            componentFileSamples: [],
            notes: ["Configured repo path is not a git worktree."],
        };
        return {
            repo: {
                path: repoPath,
                requestedBranch: requestedBranch || null,
                requestedBranchRef: null,
                resolvedBranch: null,
                resolvedHeadRef: null,
                commitSha: null,
                status: "not-git",
            },
            repoIndex,
            evidenceSummary: {
                status: "not-git",
                packageRoots: [],
                componentRoots: [],
                routeRoots: [],
                tokenSources: configuredTokenSources,
                storybookDetected: false,
                uiLibraryCandidates: [],
            },
            logLines: ["- Repo adapter failed: configured path is not a git repository."],
        };
    }
    const currentBranch = runGit(repoPath, ["branch", "--show-current"]);
    const commitSha = runGit(repoPath, ["rev-parse", "--short", "HEAD"]);
    const requestedBranchRef = resolveRequestedBranchRef(repoPath, requestedBranch);
    const resolvedHeadRef = currentBranch ? `refs/heads/${currentBranch}` : null;
    const branchExists = requestedBranch ? Boolean(requestedBranchRef) : Boolean(currentBranch);
    let status = "verified";
    const notes = [];
    if (!branchExists) {
        status = "missing-branch";
        if (requestedBranch) {
            notes.push("Requested branch was not found in local or remote refs.");
        }
        else {
            notes.push("No branch was configured and the local checkout is not on a named branch.");
        }
    }
    else if (requestedBranch && currentBranch && requestedBranch !== currentBranch) {
        status = "branch-mismatch";
        notes.push("Requested branch exists, but the local checkout is on a different branch.");
        notes.push("Repo indexing reflects the checked-out working tree, not the requested branch.");
    }
    if (requestedBranchRef) {
        notes.push(`Requested branch resolved to ${requestedBranchRef}.`);
    }
    if (resolvedHeadRef) {
        notes.push(`Current checkout HEAD resolves to ${resolvedHeadRef}.`);
    }
    const workspaceFiles = WORKSPACE_FILE_CANDIDATES
        .filter((fileName) => isFile(path.join(repoPath, fileName)))
        .sort((a, b) => a.localeCompare(b));
    const packageJsonFiles = walkFiles(repoPath, 4)
        .filter((filePath) => path.basename(filePath) === "package.json");
    const packageRoots = uniqueSorted(packageJsonFiles.map((filePath) => relativeToRepo(repoPath, path.dirname(filePath))));
    const { appRoots, componentRoots, routeRoots } = detectRoots(repoPath, packageRoots);
    const tokenSources = detectTokenSources(repoPath, packageJsonFiles, configuredTokenSources);
    const storybook = detectStorybook(repoPath);
    const uiLibraryCandidates = detectUiLibraries(packageJsonFiles);
    const componentFileSamples = sampleComponentFiles(repoPath, componentRoots);
    const repoIndex = {
        generatedAt,
        status,
        repoPath,
        requestedBranch: requestedBranch || null,
        requestedBranchRef,
        resolvedBranch: currentBranch || null,
        resolvedHeadRef,
        commitSha,
        packageManager: detectPackageManager(repoPath),
        workspaceFiles,
        packageRoots,
        appRoots,
        componentRoots,
        routeRoots,
        tokenSources,
        storybookDetected: storybook.detected,
        storybookRoots: storybook.roots,
        uiLibraryCandidates,
        componentFileSamples,
        notes,
    };
    const logLines = [
        `- Repo adapter status: ${status}`,
        `- Requested branch ref: ${requestedBranchRef || "(not found)"}`,
        `- Resolved branch: ${currentBranch || "(unknown)"}`,
        `- Commit SHA: ${commitSha || "(unknown)"}`,
        `- Package roots: ${packageRoots.length}`,
        `- Component roots: ${componentRoots.length}`,
        `- Route roots: ${routeRoots.length}`,
        `- Token sources: ${tokenSources.length}`,
        `- Storybook detected: ${storybook.detected ? "yes" : "no"}`,
        `- UI library candidates: ${uiLibraryCandidates.length > 0 ? uiLibraryCandidates.join(", ") : "(none)"}`,
    ];
    if (notes.length > 0) {
        for (const note of notes) {
            logLines.push(`- Note: ${note}`);
        }
    }
    return {
        repo: {
            path: repoPath,
            requestedBranch: requestedBranch || null,
            requestedBranchRef,
            resolvedBranch: currentBranch || null,
            resolvedHeadRef,
            commitSha,
            status,
        },
        repoIndex,
        evidenceSummary: {
            status,
            packageRoots,
            componentRoots,
            routeRoots,
            tokenSources,
            storybookDetected: storybook.detected,
            uiLibraryCandidates,
        },
        logLines,
    };
}
