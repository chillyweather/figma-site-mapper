import React, { useCallback } from "react";
import { useAtom } from "jotai";
import { currentViewAtom } from "../store/atoms";
import { useSettings } from "../hooks/useSettings";
import { useCrawl } from "../hooks/useCrawl";
import { useFlowMapping } from "../hooks/useFlowMapping";
import { MainView } from "./MainView";
import { SettingsView } from "./SettingsView";

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useAtom(currentViewAtom);
  const { settings, updateSetting } = useSettings();
  const { isLoading, status, jobId, authStatus, handleSubmit } = useCrawl();
  const { badgeLinks, checkedLinks, handleLinkCheck, handleShowFlow } =
    useFlowMapping();

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

  const handleAuthMethodChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateSetting(
        "authMethod",
        e.target.value as "none" | "credentials" | "cookies"
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

  return currentView === "settings" ? (
    <SettingsView
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
    />
  );
};
