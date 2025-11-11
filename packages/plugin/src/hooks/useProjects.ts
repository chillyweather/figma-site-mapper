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
      const hasActive =
        activeProjectId &&
        result.projects.some((project) => project._id === activeProjectId);
      if (!hasActive) {
        const nextProjectId = result.projects[0]
          ? result.projects[0]._id
          : null;
        setProjectId(nextProjectId);
      }
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
  }, [activeProjectId, setProjectId, setProjects]);

  useEffect(() => {
    if (projects.length === 0) {
      refresh();
    }
  }, [projects.length, refresh]);

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
    [setProjectId, setProjects]
  );

  const setActiveProjectId = useCallback(
    (projectId: string | null) => {
      setProjectId(projectId);
    },
    [setProjectId]
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
