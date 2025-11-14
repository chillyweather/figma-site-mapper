export const BACKEND_URL = "https://fsm.dmdz.dev";
// export const BACKEND_URL = "http://localhost:3006";
export const DEFAULT_SCREENSHOT_WIDTH = 1440;

export const UI_CONFIG = {
  width: 480,
  height: 1200,
  themeColors: true,
};

export const BADGE_COLORS = {
  INTERNAL: { r: 0.9, g: 0.45, b: 0.1 },
  EXTERNAL: { r: 0.1, g: 0.6, b: 0.7 },
} as const;

export const POLLING_CONFIG = {
  INTERVAL_MS: 3000,
  MAX_ATTEMPTS: 60,
};
