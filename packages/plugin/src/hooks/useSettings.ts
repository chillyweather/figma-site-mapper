import { useAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';
import { settingsAtom } from '../store/atoms';
import { PluginSettings } from '../types';

export function useSettings() {
  const [settings, setSettings] = useAtom(settingsAtom);
  const settingsSaveTimeoutRef = useRef<number | null>(null);

  // Load settings from clientStorage on mount
  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'load-settings' } }, '*');

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'settings-loaded') {
        if (msg.settings) {
          setSettings(msg.settings);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setSettings]);

  // Save settings to clientStorage with debouncing
  const saveSettings = useCallback((newSettings: PluginSettings) => {
    if (settingsSaveTimeoutRef.current) {
      clearTimeout(settingsSaveTimeoutRef.current);
    }

    settingsSaveTimeoutRef.current = window.setTimeout(() => {
      parent.postMessage({ pluginMessage: { type: 'save-settings', settings: newSettings } }, '*');
    }, 500);
  }, []);

  // Update individual settings
  const updateSetting = useCallback(<K extends keyof PluginSettings>(
    key: K,
    value: PluginSettings[K]
  ) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      saveSettings(newSettings);
      return newSettings;
    });
  }, [setSettings, saveSettings]);

  return {
    settings,
    updateSetting,
    setSettings
  };
}
