import React, { useCallback } from "react";
import { useAtom } from "jotai";
import { currentViewAtom } from "../store/atoms";
import { useSettings } from "../hooks/useSettings";
import { useCrawl } from "../hooks/useCrawl";
import { useProjects } from "../hooks/useProjects";
import { MainView } from "./MainView";
import { SettingsView } from "./SettingsView";

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useAtom(currentViewAtom);
  const { settings, updateSetting } = useSettings();
  const {
    isLoading,
    isRenderingSnapshot,
    status,
    jobId,
    authStatus,
    handleSubmit,
    handleRenderSnapshot,
    handleOpenAuthSession,
    crawlProgress,
  } = useCrawl();
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    isLoading: isProjectLoading,
    isCreating: isCreatingProject,
    isDeleting: isDeletingProject,
    error: projectError,
    refresh,
    createProject,
    deleteProject,
  } = useProjects();
  const handleProjectChange = useCallback(
    (projectId: string | null) => {
      setActiveProjectId(projectId);
    },
    [setActiveProjectId]
  );

  const handleCreateProject = useCallback(
    async (name: string) => {
      await createProject(name);
    },
    [createProject]
  );

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      await deleteProject(projectId);
    },
    [deleteProject]
  );

  // View switching
  const switchToMain = useCallback(
    () => setCurrentView("main"),
    [setCurrentView]
  );
  const switchToSettings = useCallback(
    () => setCurrentView("settings"),
    [setCurrentView]
  );

  // Input handlers with Jotai
  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("url", e.target.value);
    },
    [updateSetting]
  );

  const handleScreenshotWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("screenshotWidth", e.target.value);
    },
    [updateSetting]
  );

  const handleDeviceScaleFactorChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateSetting("deviceScaleFactor", e.target.value);
    },
    [updateSetting]
  );

  const handleDelayChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("delay", e.target.value);
    },
    [updateSetting]
  );

  const handleRequestDelayChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("requestDelay", e.target.value);
    },
    [updateSetting]
  );

  const handleMaxRequestsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("maxRequests", e.target.value);
    },
    [updateSetting]
  );

  const handleDefaultLanguageOnlyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("defaultLanguageOnly", e.target.checked);
    },
    [updateSetting]
  );

  const handleFullRefreshChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("fullRefresh", e.target.checked);
    },
    [updateSetting]
  );

  const handleShowBrowserChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("showBrowser", e.target.checked);
    },
    [updateSetting]
  );

  const handleAuthMethodChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateSetting(
        "authMethod",
        e.target.value as "none" | "manual" | "credentials" | "cookies"
      );
    },
    [updateSetting]
  );

  const handleCookieBannerHandlingChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateSetting(
        "cookieBannerHandling",
        e.target.value as "auto" | "hide" | "off"
      );
    },
    [updateSetting]
  );

  const handleScreenshotLayoutChange = useCallback(
    (value: "per-page" | "single-canvas") => {
      updateSetting("screenshotLayout", value);
    },
    [updateSetting]
  );

  const handleSingleCanvasColumnsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (Number.isFinite(val) && val >= 1 && val <= 10) {
        updateSetting("singleCanvasColumns", val);
      }
    },
    [updateSetting]
  );

  const handleSingleCanvasHorizontalGapChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (Number.isFinite(val) && val >= 0) {
        updateSetting("singleCanvasHorizontalGap", val);
      }
    },
    [updateSetting]
  );

  // Note: Project persistence is handled by useProjects.setActiveProjectId
  // via the 'save-project' message, so no separate useEffect needed here

  return currentView === "settings" ? (
    <SettingsView
      url={settings.url}
      screenshotWidth={settings.screenshotWidth}
      handleScreenshotWidthChange={handleScreenshotWidthChange}
      deviceScaleFactor={settings.deviceScaleFactor}
      handleDeviceScaleFactorChange={handleDeviceScaleFactorChange}
      delay={settings.delay}
      handleDelayChange={handleDelayChange}
      requestDelay={settings.requestDelay}
      handleRequestDelayChange={handleRequestDelayChange}
      maxRequests={settings.maxRequests}
      handleMaxRequestsChange={handleMaxRequestsChange}
      defaultLanguageOnly={settings.defaultLanguageOnly}
      handleDefaultLanguageOnlyChange={handleDefaultLanguageOnlyChange}
      fullRefresh={settings.fullRefresh}
      handleFullRefreshChange={handleFullRefreshChange}
      showBrowser={settings.showBrowser}
      handleShowBrowserChange={handleShowBrowserChange}
      authMethod={settings.authMethod}
      handleAuthMethodChange={handleAuthMethodChange}
      cookieBannerHandling={settings.cookieBannerHandling}
      handleCookieBannerHandlingChange={handleCookieBannerHandlingChange}
      screenshotLayout={settings.screenshotLayout}
      handleScreenshotLayoutChange={handleScreenshotLayoutChange}
      singleCanvasColumns={settings.singleCanvasColumns}
      handleSingleCanvasColumnsChange={handleSingleCanvasColumnsChange}
      singleCanvasHorizontalGap={settings.singleCanvasHorizontalGap}
      handleSingleCanvasHorizontalGapChange={handleSingleCanvasHorizontalGapChange}
      authStatus={authStatus}
      isLoading={isLoading}
      jobId={jobId}
      switchToMain={switchToMain}
      projects={projects}
      activeProjectId={activeProjectId}
      onProjectChange={handleProjectChange}
      onCreateProject={handleCreateProject}
      onDeleteProject={handleDeleteProject}
      onRefreshProjects={refresh}
      isProjectLoading={isProjectLoading}
      isCreatingProject={isCreatingProject}
      isDeletingProject={isDeletingProject}
      projectError={projectError}
    />
  ) : (
    <MainView
      activeProjectId={activeProjectId}
      url={settings.url}
      handleUrlChange={handleUrlChange}
      isLoading={isLoading}
      jobId={jobId}
      status={status}
      switchToSettings={switchToSettings}
      crawlProgress={crawlProgress}
      isRenderingSnapshot={isRenderingSnapshot}
    />
  );
};
