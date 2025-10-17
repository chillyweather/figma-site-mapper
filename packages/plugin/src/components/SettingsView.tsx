import React from "react";
import { IconSettings, IconKey, IconCheck, IconX } from "@tabler/icons-react";
import { SettingsViewProps } from "../types/index";
import { FocusedInput } from "./common/FocusedInput";
import { FocusedTextarea } from "./common/FocusedTextarea";

export const SettingsView: React.FC<SettingsViewProps> = ({
  url,
  screenshotWidth,
  handleScreenshotWidthChange,
  deviceScaleFactor,
  handleDeviceScaleFactorChange,
  delay,
  handleDelayChange,
  requestDelay,
  handleRequestDelayChange,
  maxRequests,
  handleMaxRequestsChange,
  maxDepth,
  handleMaxDepthChange,
  sampleSize,
  handleSampleSizeChange,
  defaultLanguageOnly,
  handleDefaultLanguageOnlyChange,
  showBrowser,
  handleShowBrowserChange,
  detectInteractiveElements,
  handleDetectInteractiveElementsChange,
  captureOnlyVisibleElements,
  handleCaptureOnlyVisibleElementsChange,
  authMethod,
  handleAuthMethodChange,
  loginUrl,
  handleLoginUrlChange,
  username,
  handleUsernameChange,
  password,
  handlePasswordChange,
  cookies,
  handleCookiesChange,
  authStatus,
  isLoading,
  jobId,
  switchToMain,
}) => (
  <div
    id="settings-view"
    style={{ padding: "16px", fontFamily: "Inter, sans-serif" }}
  >
    <div
      id="settings-header"
      style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}
    >
      <button
        id="settings-back-button"
        onClick={switchToMain}
        style={{
          background: "none",
          border: "none",
          padding: "4px 8px",
          marginRight: "8px",
          cursor: "pointer",
          fontSize: "14px",
        }}
      >
        ← Back
      </button>
      <h3
        id="settings-title"
        style={{ margin: "0", fontSize: "14px", fontWeight: 600 }}
      >
        Settings
      </h3>
    </div>

    <div id="screenshot-settings-section" style={{ marginBottom: "16px" }}>
      <label
        style={{
          display: "block",
          fontSize: "12px",
          marginBottom: "4px",
          fontWeight: "500",
        }}
      >
        Screenshot Settings
      </label>
      <FocusedInput
        id="screenshot-width-input"
        key="screenshot-width-input"
        type="number"
        value={screenshotWidth}
        onChange={handleScreenshotWidthChange}
        placeholder="Screenshot width (1440)"
        disabled={isLoading || !!jobId}
        style={{
          width: "100%",
          padding: "8px",
          boxSizing: "border-box",
          marginBottom: "4px",
        }}
        min="320"
        max="3840"
      />
      <div style={{ fontSize: "10px", color: "#666", marginBottom: "8px" }}>
        Screenshot width in pixels (320-3840px)
      </div>
      <select
        id="device-scale-factor-select"
        value={deviceScaleFactor}
        onChange={handleDeviceScaleFactorChange}
        disabled={isLoading || !!jobId}
        style={{
          width: "100%",
          padding: "8px",
          boxSizing: "border-box",
          marginBottom: "4px",
        }}
      >
        <option value="1">1x Resolution</option>
        <option value="2">2x Resolution (Higher Quality)</option>
      </select>
      <div style={{ fontSize: "10px", color: "#666", marginBottom: "16px" }}>
        Higher resolution screenshots take longer to process
      </div>
    </div>

    <div id="crawl-performance-section" style={{ marginBottom: "16px" }}>
      <label
        style={{
          display: "block",
          fontSize: "12px",
          marginBottom: "4px",
          fontWeight: "500",
        }}
      >
        Crawl Performance
      </label>
      <FocusedInput
        id="delay-input"
        key="delay-input"
        type="number"
        value={delay}
        onChange={handleDelayChange}
        placeholder="Delay in seconds (0)"
        disabled={isLoading || !!jobId}
        style={{
          width: "100%",
          padding: "8px",
          boxSizing: "border-box",
          marginBottom: "4px",
        }}
        min="0"
        max="60"
      />
      <div style={{ fontSize: "10px", color: "#666", marginBottom: "8px" }}>
        Additional delay after page load (0-60 seconds)
      </div>
      <FocusedInput
        id="request-delay-input"
        key="request-delay-input"
        type="number"
        value={requestDelay}
        onChange={handleRequestDelayChange}
        placeholder="Delay between requests in ms (1000)"
        disabled={isLoading || !!jobId}
        style={{
          width: "100%",
          padding: "8px",
          boxSizing: "border-box",
          marginBottom: "4px",
        }}
        min="0"
        max="10000"
      />
      <div style={{ fontSize: "10px", color: "#666", marginBottom: "16px" }}>
        Delay between requests to avoid rate limiting (0-10000ms)
      </div>
    </div>

    <div id="crawl-limits-section" style={{ marginBottom: "16px" }}>
      <label
        style={{
          display: "block",
          fontSize: "12px",
          marginBottom: "4px",
          fontWeight: "500",
        }}
      >
        Crawl Limits
      </label>
      <FocusedInput
        id="max-requests-input"
        key="max-requests-input"
        type="number"
        value={maxRequests}
        onChange={handleMaxRequestsChange}
        placeholder="Max requests (10)"
        disabled={isLoading || !!jobId}
        style={{
          width: "100%",
          padding: "8px",
          boxSizing: "border-box",
          marginBottom: "4px",
        }}
        min="0"
      />
      <div style={{ fontSize: "10px", color: "#666", marginBottom: "8px" }}>
        Leave empty, 0, or ≥999 for unlimited requests
      </div>
      <FocusedInput
        key="max-depth-input"
        type="number"
        value={maxDepth}
        onChange={handleMaxDepthChange}
        placeholder="Max crawl depth (2)"
        disabled={isLoading || !!jobId}
        style={{
          width: "100%",
          padding: "8px",
          boxSizing: "border-box",
          marginBottom: "4px",
        }}
        min="1"
        max="10"
      />
      <div style={{ fontSize: "10px", color: "#666", marginBottom: "8px" }}>
        How many levels deep to crawl (0 or empty = no limit, 1-10)
      </div>
      <FocusedInput
        key="sample-size-input"
        type="number"
        value={sampleSize}
        onChange={handleSampleSizeChange}
        placeholder="Pages per section (3)"
        disabled={isLoading || !!jobId}
        style={{
          width: "100%",
          padding: "8px",
          boxSizing: "border-box",
          marginBottom: "4px",
        }}
        min="1"
        max="20"
      />
      <div style={{ fontSize: "10px", color: "#666", marginBottom: "8px" }}>
        Max pages to crawl per section (0 or empty = no limit, 1-20)
      </div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: "12px",
          cursor: "pointer",
        }}
      >
        <input
          id="default-language-only-checkbox"
          type="checkbox"
          checked={defaultLanguageOnly}
          onChange={handleDefaultLanguageOnlyChange}
          disabled={isLoading || !!jobId}
          style={{ marginRight: "8px" }}
        />
        Crawl only default language pages
      </label>
      <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>
        Detects language from URL patterns like /en/, /fr/, ?lang=de, etc.
      </div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: "12px",
          cursor: "pointer",
          marginTop: "8px",
        }}
      >
        <input
          id="show-browser-checkbox"
          type="checkbox"
          checked={showBrowser}
          onChange={handleShowBrowserChange}
          disabled={isLoading || !!jobId}
          style={{ marginRight: "8px" }}
        />
        Show browser window during crawl
      </label>
      <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>
        Keep browser visible for manual intervention (CAPTCHA, login, etc.)
      </div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: "12px",
          cursor: "pointer",
          marginTop: "8px",
        }}
      >
        <input
          id="detect-interactive-elements-checkbox"
          type="checkbox"
          checked={detectInteractiveElements}
          onChange={handleDetectInteractiveElementsChange}
          disabled={isLoading || !!jobId}
          style={{ marginRight: "8px" }}
        />
        Detect interactive elements
      </label>
      <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>
        Add numbered frames around links and buttons for user journey mapping
      </div>
    </div>

    <div id="authentication-section" style={{ marginBottom: "16px" }}>
      <label
        style={{
          display: "block",
          fontSize: "12px",
          marginBottom: "4px",
          fontWeight: "500",
        }}
      >
        Authentication
      </label>
      <select
        id="auth-method-select"
        value={authMethod}
        onChange={handleAuthMethodChange}
        disabled={isLoading || !!jobId}
        style={{
          width: "100%",
          padding: "8px",
          boxSizing: "border-box",
          marginBottom: "8px",
          fontSize: "12px",
        }}
      >
        <option value="none">No Authentication</option>
        <option value="manual">Manual (Browser Session)</option>
        <option value="credentials">Auto Login (Username/Password)</option>
        <option value="cookies">Import Cookies</option>
      </select>

      {authMethod === "manual" && (
        <div id="auth-manual-section" style={{ marginBottom: "8px" }}>
          <div style={{ fontSize: "11px", color: "#666", marginBottom: "8px" }}>
            Opens a browser where you can manually log in or solve CAPTCHA.
            Cookies will be captured automatically when you close the browser.
          </div>
          <button
            id="open-auth-browser-button"
            type="button"
            onClick={() => {
              if (!url.trim()) {
                alert("Please enter a URL first (in the main view)");
                return;
              }
              parent.postMessage(
                { 
                  pluginMessage: { 
                    type: "open-auth-session",
                    url: url.trim()
                  } 
                },
                "*"
              );
            }}
            disabled={isLoading || !!jobId || !url.trim()}
            style={{
              width: "100%",
              padding: "8px 16px",
              backgroundColor: isLoading || !!jobId || !url.trim() ? "#e9ecef" : "#0066cc",
              color: isLoading || !!jobId || !url.trim() ? "#6c757d" : "white",
              border: "none",
              borderRadius: "4px",
              cursor: isLoading || !!jobId || !url.trim() ? "not-allowed" : "pointer",
              fontSize: "12px",
              fontWeight: "500",
            }}
          >
            {authStatus === "authenticating"
              ? "Browser Open - Complete auth and close..."
              : "Open Authentication Browser"}
          </button>
          {authStatus === "success" && (
            <div
              style={{
                fontSize: "11px",
                color: "#155724",
                marginTop: "4px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <IconCheck size={12} />
              Authentication successful - cookies captured
            </div>
          )}
          {authStatus === "failed" && (
            <div
              style={{
                fontSize: "11px",
                color: "#721c24",
                marginTop: "4px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <IconX size={12} />
              Authentication failed
            </div>
          )}
        </div>
      )}

      {authMethod === "credentials" && (
        <div id="auth-credentials-inputs" style={{ marginBottom: "8px" }}>
          <FocusedInput
            id="login-url-input"
            key="login-url-input"
            type="url"
            value={loginUrl}
            onChange={handleLoginUrlChange}
            placeholder="Login page URL (e.g., https://example.com/login)"
            disabled={isLoading || !!jobId}
            style={{
              width: "100%",
              padding: "8px",
              boxSizing: "border-box",
              marginBottom: "6px",
            }}
          />
          <FocusedInput
            id="username-input"
            key="username-input"
            type="text"
            value={username}
            onChange={handleUsernameChange}
            placeholder="Username or Email"
            disabled={isLoading || !!jobId}
            style={{
              width: "100%",
              padding: "8px",
              boxSizing: "border-box",
              marginBottom: "6px",
            }}
          />
          <FocusedInput
            id="password-input"
            key="password-input"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="Password"
            disabled={isLoading || !!jobId}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
          />
          <div style={{ fontSize: "10px", color: "#666", marginTop: "4px" }}>
            We'll automatically navigate to the login page and authenticate
          </div>
        </div>
      )}

      {authMethod === "cookies" && (
        <div id="auth-cookies-inputs" style={{ marginBottom: "8px" }}>
          <FocusedTextarea
            id="cookies-textarea"
            key="cookies-textarea"
            value={cookies}
            onChange={handleCookiesChange}
            placeholder="Paste cookies here (format: name=value; sessionid=abc123)"
            disabled={isLoading || !!jobId}
            style={{
              width: "100%",
              padding: "8px",
              boxSizing: "border-box",
              minHeight: "60px",
              resize: "vertical",
            }}
          />
          <div style={{ fontSize: "10px", color: "#666", marginTop: "4px" }}>
            Copy cookies from your browser's developer tools (F12 → Application
            → Cookies)
          </div>
        </div>
      )}

      {authStatus === "authenticating" && (
        <div
          style={{
            fontSize: "11px",
            color: "#856404",
            marginTop: "4px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <IconKey size={12} />
          Authenticating...
        </div>
      )}
      {authStatus === "success" && (
        <div
          style={{
            fontSize: "11px",
            color: "#155724",
            marginTop: "4px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <IconCheck size={12} />
          Authentication successful
        </div>
      )}
      {authStatus === "failed" && (
        <div
          style={{
            fontSize: "11px",
            color: "#721c24",
            marginTop: "4px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <IconX size={12} />
          Authentication failed - will crawl public pages only
        </div>
      )}
    </div>
  </div>
);
