import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { IconSettings, IconKey, IconCheck, IconX, IconRocket } from '@tabler/icons-react';

// Define the settings structure
interface PluginSettings {
  url: string;
  maxRequests: string;
  screenshotWidth: string;
  deviceScaleFactor: string;
  delay: string;
  requestDelay: string;
  maxDepth: string;
  defaultLanguageOnly: boolean;
  sampleSize: string;
  authMethod: 'none' | 'credentials' | 'cookies';
  loginUrl: string;
  username: string;
  password: string;
  cookies: string;
}

// Default settings
const DEFAULT_SETTINGS: PluginSettings = {
  url: '',
  maxRequests: '10',
  screenshotWidth: '1440',
  deviceScaleFactor: '1',
  delay: '0',
  requestDelay: '1000',
  maxDepth: '2',
  defaultLanguageOnly: true,
  sampleSize: '3',
  authMethod: 'none',
  loginUrl: '',
  username: '',
  password: '',
  cookies: ''
};

// Settings key for clientStorage
const SETTINGS_KEY = 'figma-sitemapper-settings';

// Custom input component that maintains focus
const FocusedInput: React.FC<{
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  style?: React.CSSProperties;
  min?: string;
  max?: string;
}> = ({ type = 'text', value, onChange, placeholder, disabled, required, style, min, max }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Only focus if this input is already focused (maintains focus during re-renders)
  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.focus();
    }
  });

  return (
    <input
      ref={inputRef}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      style={style}
      min={min}
      max={max}
    />
  );
};

// Custom textarea component that maintains focus
const FocusedTextarea: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}> = ({ value, onChange, placeholder, disabled, style }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Only focus if this textarea is already focused (maintains focus during re-renders)
  useEffect(() => {
    if (textareaRef.current && document.activeElement === textareaRef.current) {
      textareaRef.current.focus();
    }
  });

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={style}
    />
  );
};

// Props for SettingsView component
interface SettingsViewProps {
  screenshotWidth: string;
  handleScreenshotWidthChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  deviceScaleFactor: string;
  handleDeviceScaleFactorChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  delay: string;
  handleDelayChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  requestDelay: string;
  handleRequestDelayChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  maxRequests: string;
  handleMaxRequestsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  maxDepth: string;
  handleMaxDepthChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sampleSize: string;
  handleSampleSizeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  defaultLanguageOnly: boolean;
  handleDefaultLanguageOnlyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  authMethod: 'none' | 'credentials' | 'cookies';
  handleAuthMethodChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  loginUrl: string;
  handleLoginUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  username: string;
  handleUsernameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  password: string;
  handlePasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  cookies: string;
  handleCookiesChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  authStatus: 'idle' | 'authenticating' | 'success' | 'failed';
  isLoading: boolean;
  jobId: string | null;
  switchToMain: () => void;
}

// Settings view component (moved outside App to prevent re-creation)
const SettingsView: React.FC<SettingsViewProps> = ({
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
  switchToMain
}) => (
  <div style={{ padding: '16px', fontFamily: 'Inter, sans-serif' }}>
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
      <button
        onClick={switchToMain}
        style={{
          background: 'none',
          border: 'none',
          padding: '4px 8px',
          marginRight: '8px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        ← Back
      </button>
      <h3 style={{ margin: '0', fontSize: '14px', fontWeight: 600 }}>
        Settings
      </h3>
    </div>

    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
        Screenshot Settings
      </label>
      <FocusedInput
        key="screenshot-width-input"
        type="number"
        value={screenshotWidth}
        onChange={handleScreenshotWidthChange}
        placeholder="Screenshot width (1440)"
        disabled={isLoading || !!jobId}
        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '4px' }}
        min="320"
        max="3840"
      />
      <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>
        Screenshot width in pixels (320-3840px)
      </div>
      <select
        value={deviceScaleFactor}
        onChange={handleDeviceScaleFactorChange}
        disabled={isLoading || !!jobId}
        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '4px' }}
      >
        <option value="1">1x Resolution</option>
        <option value="2">2x Resolution (Higher Quality)</option>
      </select>
      <div style={{ fontSize: '10px', color: '#666', marginBottom: '16px' }}>
        Higher resolution screenshots take longer to process
      </div>
    </div>

    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
        Crawl Performance
      </label>
      <FocusedInput
        key="delay-input"
        type="number"
        value={delay}
        onChange={handleDelayChange}
        placeholder="Delay in seconds (0)"
        disabled={isLoading || !!jobId}
        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '4px' }}
        min="0"
        max="60"
      />
      <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>
        Additional delay after page load (0-60 seconds)
      </div>
      <FocusedInput
        key="request-delay-input"
        type="number"
        value={requestDelay}
        onChange={handleRequestDelayChange}
        placeholder="Delay between requests in ms (1000)"
        disabled={isLoading || !!jobId}
        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '4px' }}
        min="0"
        max="10000"
      />
      <div style={{ fontSize: '10px', color: '#666', marginBottom: '16px' }}>
        Delay between requests to avoid rate limiting (0-10000ms)
      </div>
    </div>

    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
        Crawl Limits
      </label>
      <FocusedInput
        key="max-requests-input"
        type="number"
        value={maxRequests}
        onChange={handleMaxRequestsChange}
        placeholder="Max requests (10)"
        disabled={isLoading || !!jobId}
        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '4px' }}
        min="0"
      />
      <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>
        Leave empty, 0, or ≥999 for unlimited requests
      </div>
      <FocusedInput
        key="max-depth-input"
        type="number"
        value={maxDepth}
        onChange={handleMaxDepthChange}
        placeholder="Max crawl depth (2)"
        disabled={isLoading || !!jobId}
        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '4px' }}
        min="1"
        max="10"
      />
      <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>
        How many levels deep to crawl (0 or empty = no limit, 1-10)
      </div>
      <FocusedInput
        key="sample-size-input"
        type="number"
        value={sampleSize}
        onChange={handleSampleSizeChange}
        placeholder="Pages per section (3)"
        disabled={isLoading || !!jobId}
        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '4px' }}
        min="1"
        max="20"
      />
      <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>
        Max pages to crawl per section (0 or empty = no limit, 1-20)
      </div>
      <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={defaultLanguageOnly}
          onChange={handleDefaultLanguageOnlyChange}
          disabled={isLoading || !!jobId}
          style={{ marginRight: '8px' }}
        />
        Crawl only default language pages
      </label>
      <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
        Detects language from URL patterns like /en/, /fr/, ?lang=de, etc.
      </div>
    </div>

    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
        Authentication
      </label>
      <select
        value={authMethod}
        onChange={handleAuthMethodChange}
        disabled={isLoading || !!jobId}
        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '8px', fontSize: '12px' }}
      >
        <option value="none">No Authentication</option>
        <option value="credentials">Auto Login (Username/Password)</option>
        <option value="cookies">Import Cookies</option>
      </select>
      
      {authMethod === 'credentials' && (
        <div style={{ marginBottom: '8px' }}>
          <FocusedInput
            key="login-url-input"
            type="url"
            value={loginUrl}
            onChange={handleLoginUrlChange}
            placeholder="Login page URL (e.g., https://example.com/login)"
            disabled={isLoading || !!jobId}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '6px' }}
          />
          <FocusedInput
            key="username-input"
            type="text"
            value={username}
            onChange={handleUsernameChange}
            placeholder="Username or Email"
            disabled={isLoading || !!jobId}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '6px' }}
          />
          <FocusedInput
            key="password-input"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="Password"
            disabled={isLoading || !!jobId}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
            We'll automatically navigate to the login page and authenticate
          </div>
        </div>
      )}
      
      {authMethod === 'cookies' && (
        <div style={{ marginBottom: '8px' }}>
          <FocusedTextarea
            key="cookies-textarea"
            value={cookies}
            onChange={handleCookiesChange}
            placeholder="Paste cookies here (format: name=value; sessionid=abc123)"
            disabled={isLoading || !!jobId}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', minHeight: '60px', resize: 'vertical' }}
          />
          <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
            Copy cookies from your browser's developer tools (F12 → Application → Cookies)
          </div>
        </div>
      )}
      
      {authStatus === 'authenticating' && (
        <div style={{ fontSize: '11px', color: '#856404', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <IconKey size={12} />
          Authenticating...
        </div>
      )}
      {authStatus === 'success' && (
        <div style={{ fontSize: '11px', color: '#155724', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <IconCheck size={12} />
          Authentication successful
        </div>
      )}
      {authStatus === 'failed' && (
        <div style={{ fontSize: '11px', color: '#721c24', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <IconX size={12} />
          Authentication failed - will crawl public pages only
        </div>
      )}
    </div>
  </div>
);

// Props for MainView component
interface MainViewProps {
  url: string;
  handleUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  jobId: string | null;
  handleSubmit: (e: React.FormEvent) => void;
  status: string;
  handleClose: () => void;
  switchToSettings: () => void;
}

// Props for CrawlingTab component
interface CrawlingTabProps {
  url: string;
  handleUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  jobId: string | null;
  handleSubmit: (e: React.FormEvent) => void;
  status: string;
  handleClose: () => void;
}

// Crawling tab component
const CrawlingTab: React.FC<CrawlingTabProps> = ({
  url,
  handleUrlChange,
  isLoading,
  jobId,
  handleSubmit,
  status,
  handleClose
}) => (
  <div>
    <div style={{ marginBottom: '16px' }}>
      <FocusedInput
        key="url-input"
        type="url"
        value={url}
        onChange={handleUrlChange}
        placeholder="https://example.com"
        required
        disabled={isLoading || !!jobId}
        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '8px' }}
      />

      <button
        onClick={handleSubmit}
        disabled={isLoading || !!jobId || !url.trim()}
        style={{ width: '100%', padding: '8px 16px', marginBottom: '8px' }}
      >
        {isLoading ? 'Starting...' : (jobId ? 'Crawl in Progress' : 'Start Crawl')}
      </button>
    </div>

    {status && (
      <div style={{ padding: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', fontSize: '11px', marginBottom: '12px', wordBreak: 'break-all' }}>
        {status}
      </div>
    )}

    <button onClick={handleClose} style={{ width: '100%', padding: '6px 16px', backgroundColor: 'transparent', border: '1px solid #ccc' }}>
      Close
    </button>
  </div>
);

// Mapping tab component (empty for now)
const MappingTab: React.FC = () => (
  <div style={{ textAlign: 'center', color: '#666', padding: '32px 16px' }}>
    <p>Mapping functionality coming soon...</p>
  </div>
);

// Main view component with tabs
const MainView: React.FC<MainViewProps> = ({
  url,
  handleUrlChange,
  isLoading,
  jobId,
  handleSubmit,
  status,
  handleClose,
  switchToSettings
}) => {
  const [activeTab, setActiveTab] = useState<'crawling' | 'mapping'>('crawling');

  return (
    <div style={{ padding: '16px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: '0', fontSize: '14px', fontWeight: 600 }}>
          Figma Site Mapper
        </h3>
        <button
          onClick={switchToSettings}
          style={{
            background: 'none',
            border: '1px solid #ccc',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '12px',
            borderRadius: '3px'
          }}
        >
          <IconSettings size={16} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', marginBottom: '16px', borderBottom: '1px solid #e0e0e0' }}>
        <button
          onClick={() => setActiveTab('crawling')}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: activeTab === 'crawling' ? '600' : '400',
            color: activeTab === 'crawling' ? '#000' : '#666',
            borderBottom: activeTab === 'crawling' ? '2px solid #0066cc' : '2px solid transparent'
          }}
        >
          Crawling
        </button>
        <button
          onClick={() => setActiveTab('mapping')}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: activeTab === 'mapping' ? '600' : '400',
            color: activeTab === 'mapping' ? '#000' : '#666',
            borderBottom: activeTab === 'mapping' ? '2px solid #0066cc' : '2px solid transparent'
          }}
        >
          Mapping
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'crawling' && (
        <CrawlingTab
          url={url}
          handleUrlChange={handleUrlChange}
          isLoading={isLoading}
          jobId={jobId}
          handleSubmit={handleSubmit}
          status={status}
          handleClose={handleClose}
        />
      )}

      {activeTab === 'mapping' && (
        <MappingTab />
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'main' | 'settings'>('main');
  const [url, setUrl] = useState('');
  const [maxRequests, setMaxRequests] = useState('10');
  const [screenshotWidth, setScreenshotWidth] = useState('1440');
  const [deviceScaleFactor, setDeviceScaleFactor] = useState('1');
  const [delay, setDelay] = useState('0');
  const [requestDelay, setRequestDelay] = useState('1000');
  const [maxDepth, setMaxDepth] = useState('2');
  const [defaultLanguageOnly, setDefaultLanguageOnly] = useState(true);
  const [sampleSize, setSampleSize] = useState('3');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  
  // Authentication state
  const [authMethod, setAuthMethod] = useState<'none' | 'credentials' | 'cookies'>('none');
  const [loginUrl, setLoginUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cookies, setCookies] = useState('');
  const [authStatus, setAuthStatus] = useState<'idle' | 'authenticating' | 'success' | 'failed'>('idle');
  const intervalRef = useRef<number | null>(null);
  const settingsSaveTimeoutRef = useRef<number | null>(null);

  // Load settings from clientStorage on component mount
  useEffect(() => {
    // Request settings from main plugin code
    parent.postMessage({ pluginMessage: { type: 'load-settings' } }, '*');
    
    // Listen for messages from main plugin code
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'settings-loaded') {
        if (msg.settings) {
          // Apply loaded settings
          setUrl(msg.settings.url || DEFAULT_SETTINGS.url);
          setMaxRequests(msg.settings.maxRequests || DEFAULT_SETTINGS.maxRequests);
          setScreenshotWidth(msg.settings.screenshotWidth || DEFAULT_SETTINGS.screenshotWidth);
          setDeviceScaleFactor(msg.settings.deviceScaleFactor || DEFAULT_SETTINGS.deviceScaleFactor);
          setDelay(msg.settings.delay || DEFAULT_SETTINGS.delay);
          setRequestDelay(msg.settings.requestDelay || DEFAULT_SETTINGS.requestDelay);
          setMaxDepth(msg.settings.maxDepth || DEFAULT_SETTINGS.maxDepth);
          setDefaultLanguageOnly(msg.settings.defaultLanguageOnly !== undefined ? msg.settings.defaultLanguageOnly : DEFAULT_SETTINGS.defaultLanguageOnly);
          setSampleSize(msg.settings.sampleSize || DEFAULT_SETTINGS.sampleSize);
          setAuthMethod(msg.settings.authMethod || DEFAULT_SETTINGS.authMethod);
          setLoginUrl(msg.settings.loginUrl || DEFAULT_SETTINGS.loginUrl);
          setUsername(msg.settings.username || DEFAULT_SETTINGS.username);
          setPassword(msg.settings.password || DEFAULT_SETTINGS.password);
          setCookies(msg.settings.cookies || DEFAULT_SETTINGS.cookies);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Save settings to clientStorage with debouncing
  const saveSettings = useCallback((settings: PluginSettings) => {
    // Clear previous timeout if it exists
    if (settingsSaveTimeoutRef.current) {
      clearTimeout(settingsSaveTimeoutRef.current);
    }
    
    // Debounce settings save to avoid excessive writes
    settingsSaveTimeoutRef.current = setTimeout(() => {
      parent.postMessage({ pluginMessage: { type: 'save-settings', settings } }, '*');
    }, 500);
  }, []);

  // Create settings object from current state
  const getCurrentSettings = useCallback((): PluginSettings => ({
    url,
    maxRequests,
    screenshotWidth,
    deviceScaleFactor,
    delay,
    requestDelay,
    maxDepth,
    defaultLanguageOnly,
    sampleSize,
    authMethod,
    loginUrl,
    username,
    password,
    cookies
  }), [url, maxRequests, screenshotWidth, deviceScaleFactor, delay, requestDelay, maxDepth, defaultLanguageOnly, sampleSize, authMethod, loginUrl, username, password, cookies]);

  // Wrapper functions for state setters that also save settings
  const setUrlAndSave = useCallback((value: string) => {
    setUrl(value);
    const newSettings = { ...getCurrentSettings(), url: value };
    saveSettings(newSettings);
  }, [getCurrentSettings, saveSettings]);

  const setMaxRequestsAndSave = useCallback((value: string) => {
    setMaxRequests(value);
    const newSettings = { ...getCurrentSettings(), maxRequests: value };
    saveSettings(newSettings);
  }, [getCurrentSettings, saveSettings]);

  const setScreenshotWidthAndSave = useCallback((value: string) => {
    setScreenshotWidth(value);
    const newSettings = { ...getCurrentSettings(), screenshotWidth: value };
    saveSettings(newSettings);
  }, [getCurrentSettings, saveSettings]);

  const setDeviceScaleFactorAndSave = useCallback((value: string) => {
    setDeviceScaleFactor(value);
    const newSettings = { ...getCurrentSettings(), deviceScaleFactor: value };
    saveSettings(newSettings);
  }, [getCurrentSettings, saveSettings]);

  const setDelayAndSave = useCallback((value: string) => {
    setDelay(value);
    const newSettings = { ...getCurrentSettings(), delay: value };
    saveSettings(newSettings);
  }, [getCurrentSettings, saveSettings]);

  const setRequestDelayAndSave = useCallback((value: string) => {
    setRequestDelay(value);
    const newSettings = { ...getCurrentSettings(), requestDelay: value };
    saveSettings(newSettings);
  }, [getCurrentSettings, saveSettings]);

  const setMaxDepthAndSave = useCallback((value: string) => {
    setMaxDepth(value);
    const newSettings = { ...getCurrentSettings(), maxDepth: value };
    saveSettings(newSettings);
  }, [getCurrentSettings, saveSettings]);

  const setDefaultLanguageOnlyAndSave = useCallback((value: boolean) => {
    setDefaultLanguageOnly(value);
    const newSettings = { ...getCurrentSettings(), defaultLanguageOnly: value };
    saveSettings(newSettings);
  }, [getCurrentSettings, saveSettings]);

  const setSampleSizeAndSave = useCallback((value: string) => {
    setSampleSize(value);
    const newSettings = { ...getCurrentSettings(), sampleSize: value };
    saveSettings(newSettings);
  }, [getCurrentSettings, saveSettings]);

  const setAuthMethodAndSave = useCallback((value: 'none' | 'credentials' | 'cookies') => {
    setAuthMethod(value);
    setAuthStatus('idle');
    const newSettings = { ...getCurrentSettings(), authMethod: value };
    saveSettings(newSettings);
  }, [getCurrentSettings, saveSettings]);

  const setLoginUrlAndSave = useCallback((value: string) => {
    setLoginUrl(value);
    const newSettings = { ...getCurrentSettings(), loginUrl: value };
    saveSettings(newSettings);
  }, [getCurrentSettings, saveSettings]);

  const setUsernameAndSave = useCallback((value: string) => {
    setUsername(value);
    const newSettings = { ...getCurrentSettings(), username: value };
    saveSettings(newSettings);
  }, [getCurrentSettings, saveSettings]);

  const setPasswordAndSave = useCallback((value: string) => {
    setPassword(value);
    const newSettings = { ...getCurrentSettings(), password: value };
    saveSettings(newSettings);
  }, [getCurrentSettings, saveSettings]);

  const setCookiesAndSave = useCallback((value: string) => {
    setCookies(value);
    const newSettings = { ...getCurrentSettings(), cookies: value };
    saveSettings(newSettings);
  }, [getCurrentSettings, saveSettings]);

  // Load settings from clientStorage on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await parent.postMessage({ pluginMessage: { type: 'load-settings' } }, '*');
        // We'll handle the response in the message event listener
      } catch (error) {
        console.error('Failed to request settings load:', error);
      }
    };

    loadSettings();
  }, []);



  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!url.trim()) return;

    console.log('Starting crawl with URL:', url.trim());

    // Parse max requests: empty, 0, or >= 999 means infinity (no limit)
    const maxRequestsValue = maxRequests.trim() === '' ? 0 : parseInt(maxRequests);
    const maxRequestsPerCrawl = (isNaN(maxRequestsValue) || maxRequestsValue === 0 || maxRequestsValue >= 999) ? undefined : maxRequestsValue;

    // Parse screenshot width: default to 1440 if invalid or empty
    const screenshotWidthValue = screenshotWidth.trim() === '' ? 1440 : parseInt(screenshotWidth);
    const screenshotWidthParam = isNaN(screenshotWidthValue) || screenshotWidthValue <= 0 ? 1440 : screenshotWidthValue;

    // Parse device scale factor: default to 1 if invalid
    const deviceScaleFactorValue = deviceScaleFactor.trim() === '' ? 1 : parseInt(deviceScaleFactor);
    const deviceScaleFactorParam = isNaN(deviceScaleFactorValue) || deviceScaleFactorValue < 1 || deviceScaleFactorValue > 2 ? 1 : deviceScaleFactorValue;

    // Parse delay: default to 0 if invalid or empty
    const delayValue = delay.trim() === '' ? 0 : parseInt(delay);
    const delayParam = isNaN(delayValue) || delayValue < 0 ? 0 : delayValue;

    // Parse request delay: default to 1000ms if invalid or empty
    const requestDelayValue = requestDelay.trim() === '' ? 1000 : parseInt(requestDelay);
    const requestDelayParam = isNaN(requestDelayValue) || requestDelayValue < 0 ? 1000 : requestDelayValue;

    // Parse max depth: 0 or empty means no limit
    const maxDepthValue = maxDepth.trim() === '' ? 0 : parseInt(maxDepth);
    const maxDepthParam = isNaN(maxDepthValue) || maxDepthValue < 0 || maxDepthValue > 10 ? 0 : maxDepthValue;

    // Parse sample size: 0 means unlimited, 1-20 are valid limits, empty defaults to 3
    let sampleSizeParam: number;
    if (sampleSize.trim() === '') {
      // Empty field defaults to 3
      sampleSizeParam = 3;
    } else {
      const parsedValue = parseInt(sampleSize);
      if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 20) {
        // Invalid values default to 3
        sampleSizeParam = 3;
      } else {
        // Valid values (including 0 for unlimited) are used as-is
        sampleSizeParam = parsedValue;
      }
    }

    // Parse authentication data
    let authData = null;
    if (authMethod === 'credentials' && loginUrl && username) {
      authData = {
        method: 'credentials' as const,
        loginUrl: loginUrl.trim(),
        username: username.trim(),
        password: password.trim()
      };
    } else if (authMethod === 'cookies' && cookies.trim()) {
      try {
        // Parse cookies from string format: "name=value; name2=value2"
        const cookieArray = cookies.split(';').map(c => c.trim()).filter(c => c);
        const parsedCookies = cookieArray.map(cookie => {
          const [name, ...valueParts] = cookie.split('=');
          return {
            name: name.trim(),
            value: valueParts.join('=').trim()
          };
        });
        authData = {
          method: 'cookies' as const,
          cookies: parsedCookies
        };
      } catch (error) {
        setStatus('Error: Invalid cookie format. Use: name=value; name2=value2');
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setStatus('Starting crawl...');

    parent.postMessage({ pluginMessage: { type: 'start-crawl', url: url.trim(), maxRequestsPerCrawl, screenshotWidth: screenshotWidthParam, deviceScaleFactor: deviceScaleFactorParam, delay: delayParam, requestDelay: requestDelayParam, maxDepth: maxDepthParam, defaultLanguageOnly, sampleSize: sampleSizeParam, auth: authData } }, '*');
  }, [url, maxRequests, screenshotWidth, deviceScaleFactor, delay, requestDelay, maxDepth, defaultLanguageOnly, sampleSize, authMethod, loginUrl, username, password, cookies]);

  const handleClose = useCallback(() => {
    parent.postMessage({ pluginMessage: { type: 'close' } }, '*');
  }, []);

  // This effect starts/stops the polling
  useEffect(() => {
    if (jobId && !intervalRef.current) {
      intervalRef.current = window.setInterval(() => {
        parent.postMessage({ pluginMessage: { type: 'get-status', jobId } }, '*');
      }, 3000);
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'crawl-started') {
        setStatus(`Crawl started! Job ID: ${msg.jobId}`);
        setJobId(msg.jobId);
        setIsLoading(false);
      }

      if (msg.type === 'status-update') {
        let statusText = `Job ${msg.jobId}: ${msg.status}`;
        
        if (msg.detailedProgress) {
          const { stage, currentPage, totalPages, currentUrl, progress } = msg.detailedProgress;
          statusText = `Job ${msg.jobId}: ${msg.status} - ${stage}`;
          
          if (currentUrl) {
            statusText += ` - ${currentUrl}`;
          }
          
          if (currentPage && totalPages) {
            statusText += ` (${currentPage}/${totalPages})`;
          }
          
          if (typeof progress === 'number') {
            statusText += ` ${progress}%`;
          }
        } else if (msg.progress && typeof msg.progress === 'number') {
          statusText += ` (${msg.progress}%)`;
        }
        
        setStatus(statusText);

        if (msg.status === 'completed') {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setStatus(`Crawl complete! Manifest at: ${msg.manifestUrl}`);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Stable input handlers to prevent focus loss
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlAndSave(e.target.value);
  }, [setUrlAndSave]);

  const handleScreenshotWidthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setScreenshotWidthAndSave(e.target.value);
  }, [setScreenshotWidthAndSave]);

  const handleDeviceScaleFactorChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setDeviceScaleFactorAndSave(e.target.value);
  }, [setDeviceScaleFactorAndSave]);

  const handleDelayChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDelayAndSave(e.target.value);
  }, [setDelayAndSave]);

  const handleRequestDelayChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRequestDelayAndSave(e.target.value);
  }, [setRequestDelayAndSave]);

  const handleMaxRequestsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxRequestsAndSave(e.target.value);
  }, [setMaxRequestsAndSave]);

  const handleMaxDepthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxDepthAndSave(e.target.value);
  }, [setMaxDepthAndSave]);

  const handleSampleSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSampleSizeAndSave(e.target.value);
  }, [setSampleSizeAndSave]);

  const handleDefaultLanguageOnlyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDefaultLanguageOnlyAndSave(e.target.checked);
  }, [setDefaultLanguageOnlyAndSave]);

  const handleAuthMethodChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setAuthMethodAndSave(e.target.value as 'none' | 'credentials' | 'cookies');
  }, [setAuthMethodAndSave]);

  const handleLoginUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginUrlAndSave(e.target.value);
  }, [setLoginUrlAndSave]);

  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUsernameAndSave(e.target.value);
  }, [setUsernameAndSave]);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordAndSave(e.target.value);
  }, [setPasswordAndSave]);

  const handleCookiesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCookiesAndSave(e.target.value);
  }, [setCookiesAndSave]);

  // Stable view switching callbacks
  const switchToMain = useCallback(() => setCurrentView('main'), []);
  const switchToSettings = useCallback(() => setCurrentView('settings'), []);

  // Pass all necessary props to the view components
  return currentView === 'settings' ? (
    <SettingsView
      screenshotWidth={screenshotWidth}
      handleScreenshotWidthChange={handleScreenshotWidthChange}
      deviceScaleFactor={deviceScaleFactor}
      handleDeviceScaleFactorChange={handleDeviceScaleFactorChange}
      delay={delay}
      handleDelayChange={handleDelayChange}
      requestDelay={requestDelay}
      handleRequestDelayChange={handleRequestDelayChange}
      maxRequests={maxRequests}
      handleMaxRequestsChange={handleMaxRequestsChange}
      maxDepth={maxDepth}
      handleMaxDepthChange={handleMaxDepthChange}
      sampleSize={sampleSize}
      handleSampleSizeChange={handleSampleSizeChange}
      defaultLanguageOnly={defaultLanguageOnly}
      handleDefaultLanguageOnlyChange={handleDefaultLanguageOnlyChange}
      authMethod={authMethod}
      handleAuthMethodChange={handleAuthMethodChange}
      loginUrl={loginUrl}
      handleLoginUrlChange={handleLoginUrlChange}
      username={username}
      handleUsernameChange={handleUsernameChange}
      password={password}
      handlePasswordChange={handlePasswordChange}
      cookies={cookies}
      handleCookiesChange={handleCookiesChange}
      authStatus={authStatus}
      isLoading={isLoading}
      jobId={jobId}
      switchToMain={switchToMain}
    />
  ) : (
    <MainView
      url={url}
      handleUrlChange={handleUrlChange}
      isLoading={isLoading}
      jobId={jobId}
      handleSubmit={handleSubmit}
      status={status}
      handleClose={handleClose}
      switchToSettings={switchToSettings}
    />
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}