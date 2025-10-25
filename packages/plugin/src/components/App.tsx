import React, { useCallback } from "react";
import { useAtom } from "jotai";
import {
  currentViewAtom,
  elementFiltersAtom,
  categorizedElementsAtom,
  selectedPageUrlAtom,
  manifestDataAtom,
} from "../store/atoms";
import { useSettings } from "../hooks/useSettings";
import { useCrawl } from "../hooks/useCrawl";
import { useFlowMapping } from "../hooks/useFlowMapping";
import { useElementData } from "../hooks/useElementData";
import { MainView } from "./MainView";
import { SettingsView } from "./SettingsView";
import { StylingView } from "./StylingView";
import { getPresetConfig } from "../utils/stylePresets";
import { ElementFilters } from "../types";

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useAtom(currentViewAtom);
  const { settings, updateSetting } = useSettings();
  const { isLoading, status, jobId, authStatus, handleSubmit, crawlProgress } =
    useCrawl();
  const {
    badgeLinks,
    checkedLinks,
    handleLinkCheck,
    handleShowFlow,
    flowProgress,
  } = useFlowMapping();

  // Element mode, filters, and page selection
  const [selectedPageUrl, setSelectedPageUrl] = useAtom(selectedPageUrlAtom);
  const [manifestData] = useAtom(manifestDataAtom);

  // Load and categorize elements from manifest for selected page
  useElementData(selectedPageUrl);

  const [elementFilters, setElementFilters] = useAtom(elementFiltersAtom);
  const [categorizedElements] = useAtom(categorizedElementsAtom);

  // Element filter handler
  const handleElementFilterChange = useCallback(
    (elementType: keyof ElementFilters, checked: boolean) => {
      setElementFilters((prev) => ({
        ...prev,
        [elementType]: checked,
      }));
    },
    [setElementFilters]
  );

  // Page selection handler
  const handlePageSelection = useCallback(
    (pageUrl: string) => {
      setSelectedPageUrl(pageUrl);
    },
    [setSelectedPageUrl]
  );

  // Styling mode handler (placeholder for now)
  const handleShowStyling = useCallback(() => {
    console.log("Show styling with filters:", elementFilters);
    console.log("Selected page URL:", selectedPageUrl);
    // TODO: Implement styling mode rendering
    parent.postMessage(
      {
        pluginMessage: {
          type: "show-styling-elements",
          filters: elementFilters,
          pageUrl: selectedPageUrl,
        },
      },
      "*"
    );
  }, [elementFilters, selectedPageUrl]);

  // View switching
  const switchToMain = useCallback(
    () => setCurrentView("main"),
    [setCurrentView]
  );
  const switchToSettings = useCallback(
    () => setCurrentView("settings"),
    [setCurrentView]
  );

  // Handle close
  const handleClose = useCallback(() => {
    parent.postMessage({ pluginMessage: { type: "close" } }, "*");
  }, []);

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

  const handleShowBrowserChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("showBrowser", e.target.checked);
    },
    [updateSetting]
  );

  const handleDetectInteractiveElementsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("detectInteractiveElements", e.target.checked);
    },
    [updateSetting]
  );

  const handleHighlightAllElementsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("highlightAllElements", e.target.checked);
    },
    [updateSetting]
  );

  const handleHighlightFilterChange = useCallback(
    (elementType: keyof ElementFilters, checked: boolean) => {
      updateSetting("highlightElementFilters", {
        ...settings.highlightElementFilters,
        [elementType]: checked,
      });
    },
    [updateSetting, settings.highlightElementFilters]
  );

  const handleCaptureOnlyVisibleElementsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("captureOnlyVisibleElements", e.target.checked);
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

  const handleLoginUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("loginUrl", e.target.value);
    },
    [updateSetting]
  );

  const handleUsernameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("username", e.target.value);
    },
    [updateSetting]
  );

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting("password", e.target.value);
    },
    [updateSetting]
  );

  const handleCookiesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateSetting("cookies", e.target.value);
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

  return currentView === "styling" ? (
    <StylingView onBack={switchToMain} />
  ) : currentView === "settings" ? (
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
      showBrowser={settings.showBrowser}
      handleShowBrowserChange={handleShowBrowserChange}
      detectInteractiveElements={settings.detectInteractiveElements}
      handleDetectInteractiveElementsChange={
        handleDetectInteractiveElementsChange
      }
      highlightAllElements={settings.highlightAllElements}
      handleHighlightAllElementsChange={handleHighlightAllElementsChange}
      highlightElementFilters={settings.highlightElementFilters}
      handleHighlightFilterChange={handleHighlightFilterChange}
      captureOnlyVisibleElements={settings.captureOnlyVisibleElements}
      handleCaptureOnlyVisibleElementsChange={
        handleCaptureOnlyVisibleElementsChange
      }
      authMethod={settings.authMethod}
      handleAuthMethodChange={handleAuthMethodChange}
      loginUrl={settings.loginUrl}
      handleLoginUrlChange={handleLoginUrlChange}
      username={settings.username}
      handleUsernameChange={handleUsernameChange}
      password={settings.password}
      handlePasswordChange={handlePasswordChange}
      cookies={settings.cookies}
      handleCookiesChange={handleCookiesChange}
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
    />
  ) : (
    <MainView
      url={settings.url}
      handleUrlChange={handleUrlChange}
      isLoading={isLoading}
      jobId={jobId}
      handleSubmit={handleSubmit}
      status={status}
      handleClose={handleClose}
      switchToSettings={switchToSettings}
      badgeLinks={badgeLinks}
      checkedLinks={checkedLinks}
      handleLinkCheck={handleLinkCheck}
      handleShowFlow={handleShowFlow}
      flowProgress={flowProgress}
      crawlProgress={crawlProgress}
      // Element styling props
      categorizedElements={categorizedElements}
      elementFilters={elementFilters}
      onElementFilterChange={handleElementFilterChange}
      handleShowStyling={handleShowStyling}
      manifestData={manifestData}
      selectedPageUrl={selectedPageUrl}
      onPageSelection={handlePageSelection}
    />
  );
};
