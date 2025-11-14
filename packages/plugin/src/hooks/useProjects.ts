import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { activeProjectIdAtom, projectsAtom } from "../store/atoms";
import { Project } from "../types";
import {
  fetchProjects as fetchProjectsApi,
  createProject as createProjectApi,
} from "../utils/api";

interface UseProjectsResult {
  projects: Project[];
  activeProjectId: string | null;
  setActiveProjectId: (projectId: string | null) => void;
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createProject: (name: string) => Promise<void>;
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useAtom(projectsAtom);
  const [activeProjectId, setProjectId] = useAtom(activeProjectIdAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const [hasLoadedStoredProject, setHasLoadedStoredProject] = useState(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchProjectsApi();
      if (!isMountedRef.current) return;
      setProjects(result.projects);
      setError(null);
    } catch (err) {
      console.error("Failed to load projects", err);
      if (!isMountedRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load projects right now."
      );
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [setProjects]);

  useEffect(() => {
    // Load active project from clientStorage on mount
    console.log("📤 [useProjects] Requesting load-project from plugin...");
    parent.postMessage({ pluginMessage: { type: "load-project" } }, "*");

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === "project-loaded") {
        console.log("📥 [useProjects] Received project-loaded:", msg.projectId);
        console.log("📥 [useProjects] projectId type:", typeof msg.projectId);
        setHasLoadedStoredProject(true);
        const storedId =
          typeof msg.projectId === "string" && msg.projectId.length > 0
            ? msg.projectId
            : null;
        console.log("📥 [useProjects] Setting projectId to:", storedId);
        setProjectId(storedId);
      } else if (msg.type === "project-error") {
        console.log("📥 [useProjects] Received project-error");
        setHasLoadedStoredProject(true);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setProjectId, setHasLoadedStoredProject]);

  useEffect(() => {
    if (projects.length === 0) {
      refresh();
    }
  }, [projects.length, refresh]);

  useEffect(() => {
    console.log("🔄 [useProjects auto-select effect] Triggered");
    console.log(
      "🔄 [useProjects auto-select] hasLoadedStoredProject:",
      hasLoadedStoredProject
    );
    console.log(
      "🔄 [useProjects auto-select] projects.length:",
      projects.length
    );
    console.log(
      "🔄 [useProjects auto-select] activeProjectId:",
      activeProjectId
    );

    if (!hasLoadedStoredProject) {
      console.log(
        "⏸️  [useProjects auto-select] Waiting for stored project to load"
      );
      return;
    }

    if (projects.length === 0) {
      console.log(
        "⏸️  [useProjects auto-select] Projects not loaded yet, waiting..."
      );
      // Don't clear activeProjectId while projects are still loading
      // The stored project might be valid once the projects list loads
      return;
    }

    const hasActive =
      activeProjectId !== null &&
      projects.some((project) => project._id === activeProjectId);

    console.log("🔍 [useProjects auto-select] hasActive:", hasActive);
    console.log(
      "🔍 [useProjects auto-select] Available project IDs:",
      projects.map((p) => p._id)
    );

    if (!hasActive) {
      const nextProjectId = projects[0]?._id ?? null;
      console.log(
        "⚠️  [useProjects auto-select] Active project not found, defaulting to:",
        nextProjectId
      );
      if (nextProjectId !== activeProjectId) {
        console.log(
          "🔄 [useProjects auto-select] Setting projectId to first project:",
          nextProjectId
        );
        setProjectId(nextProjectId);
      }
    } else {
      console.log(
        "✅ [useProjects auto-select] Active project is valid, keeping it"
      );
    }
  }, [hasLoadedStoredProject, projects, activeProjectId, setProjectId]);

  const createProject = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        setError("Project name is required");
        return;
      }

      setIsCreating(true);
      try {
        const result = await createProjectApi(trimmed);
        if (!isMountedRef.current) return;
        setProjects((prev) => [result.project, ...prev]);
        setProjectId(result.project._id);
        setHasLoadedStoredProject(true);
        setError(null);
      } catch (err) {
        console.error("Failed to create project", err);
        if (!isMountedRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to create project right now."
        );
        throw err;
      } finally {
        if (isMountedRef.current) {
          setIsCreating(false);
        }
      }
    },
    [setProjectId, setProjects, setHasLoadedStoredProject]
  );

  const setActiveProjectId = useCallback(
    (projectId: string | null) => {
      console.log(
        "🔄 [useProjects.setActiveProjectId] Called with:",
        projectId
      );
      console.log(
        "🔄 [useProjects.setActiveProjectId] projectId type:",
        typeof projectId
      );
      setHasLoadedStoredProject(true);
      setProjectId(projectId);
      // Save to clientStorage whenever it changes
      console.log(
        "📤 [useProjects.setActiveProjectId] Sending save-project message"
      );
      parent.postMessage(
        { pluginMessage: { type: "save-project", projectId } },
        "*"
      );
    },
    [setProjectId, setHasLoadedStoredProject]
  );

  return {
    projects,
    activeProjectId,
    setActiveProjectId,
    isLoading,
    isCreating,
    error,
    refresh,
    createProject,
  };
}
