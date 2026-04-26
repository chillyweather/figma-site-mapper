import React, { useCallback } from "react";
import { useAtom } from "jotai";
import { currentViewAtom } from "../store/atoms";
import { useSettings } from "../hooks/useSettings";
import { useCrawl } from "../hooks/useCrawl";
import { useProjects } from "../hooks/useProjects";
import { MainView } from "./MainView";
import { SettingsView } from "./SettingsView";
import { getPresetConfig } from "../utils/stylePresets";

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

  const handleMaxDepthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("maxDepth", e.target.value);
    },
    [updateSetting]
  );

  const handleSampleSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("sampleSize", e.target.value);
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

  // Style Extraction handlers
  const handleExtractStylesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("extractStyles", e.target.checked);
    },
    [updateSetting]
  );

  const handleStyleExtractionPresetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const preset = e.target.value as
        | "smart"
        | "minimal"
        | "complete"
        | "custom";
      updateSetting("styleExtractionPreset", preset);

      // Auto-apply preset values (unless custom)
      const presetConfig = getPresetConfig(preset);
      if (presetConfig) {
        Object.entries(presetConfig).forEach(([key, value]) => {
          updateSetting(key as any, value);
        });
      }
    },
    [updateSetting]
  );

  const handleExtractInteractiveChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("extractInteractive", e.target.checked);
    },
    [updateSetting]
  );

  const handleExtractStructuralChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("extractStructural", e.target.checked);
    },
    [updateSetting]
  );

  const handleExtractContentBlocksChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("extractContentBlocks", e.target.checked);
    },
    [updateSetting]
  );

  const handleExtractFormElementsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("extractFormElements", e.target.checked);
    },
    [updateSetting]
  );

  const handleExtractCustomComponentsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("extractCustomComponents", e.target.checked);
    },
    [updateSetting]
  );

  const handleExtractColorsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("extractColors", e.target.checked);
    },
    [updateSetting]
  );

  const handleExtractTypographyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("extractTypography", e.target.checked);
    },
    [updateSetting]
  );

  const handleExtractSpacingChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("extractSpacing", e.target.checked);
    },
    [updateSetting]
  );

  const handleExtractBordersChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("extractBorders", e.target.checked);
    },
    [updateSetting]
  );

  const handleExtractLayoutChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("extractLayout", e.target.checked);
    },
    [updateSetting]
  );

  const handleExtractCSSVariablesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("extractCSSVariables", e.target.checked);
    },
    [updateSetting]
  );

  const handleDetectPatternsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("detectPatterns", e.target.checked);
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
      maxDepth={settings.maxDepth}
      handleMaxDepthChange={handleMaxDepthChange}
      sampleSize={settings.sampleSize}
      handleSampleSizeChange={handleSampleSizeChange}
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
      authStatus={authStatus}
      isLoading={isLoading}
      jobId={jobId}
      switchToMain={switchToMain}
      extractStyles={settings.extractStyles}
      handleExtractStylesChange={handleExtractStylesChange}
      styleExtractionPreset={settings.styleExtractionPreset}
      handleStyleExtractionPresetChange={handleStyleExtractionPresetChange}
      extractInteractive={settings.extractInteractive}
      handleExtractInteractiveChange={handleExtractInteractiveChange}
      extractStructural={settings.extractStructural}
      handleExtractStructuralChange={handleExtractStructuralChange}
      extractContentBlocks={settings.extractContentBlocks}
      handleExtractContentBlocksChange={handleExtractContentBlocksChange}
      extractFormElements={settings.extractFormElements}
      handleExtractFormElementsChange={handleExtractFormElementsChange}
      extractCustomComponents={settings.extractCustomComponents}
      handleExtractCustomComponentsChange={handleExtractCustomComponentsChange}
      extractColors={settings.extractColors}
      handleExtractColorsChange={handleExtractColorsChange}
      extractTypography={settings.extractTypography}
      handleExtractTypographyChange={handleExtractTypographyChange}
      extractSpacing={settings.extractSpacing}
      handleExtractSpacingChange={handleExtractSpacingChange}
      extractBorders={settings.extractBorders}
      handleExtractBordersChange={handleExtractBordersChange}
      extractLayout={settings.extractLayout}
      handleExtractLayoutChange={handleExtractLayoutChange}
      extractCSSVariables={settings.extractCSSVariables}
      handleExtractCSSVariablesChange={handleExtractCSSVariablesChange}
      detectPatterns={settings.detectPatterns}
      handleDetectPatternsChange={handleDetectPatternsChange}
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
      handleSubmit={handleSubmit}
      status={status}
      switchToSettings={switchToSettings}
      crawlProgress={crawlProgress}
      authStatus={authStatus}
      authMethod={settings.authMethod}
      onAuthorize={handleOpenAuthSession}
      handleRenderSnapshot={handleRenderSnapshot}
      isRenderingSnapshot={isRenderingSnapshot}
    />
  );
};
