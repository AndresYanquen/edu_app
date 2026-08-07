const THEME_SETTING_KEY = 'theme';

const DEFAULT_THEME = {
  colors: {
    brandPrimary: '#12355b',
    brandPrimaryHover: '#0b2545',
    brandPrimarySoft: '#e8f1fb',
    brandAccent: '#c99700',
    brandAccentStrong: '#a87500',
    brandAccentSoft: '#fff6d8',
    appBg: '#f6f8fb',
    appSurface: '#ffffff',
    appSurface2: '#f8fafc',
    appBorder: '#dbe3ef',
    textPrimary: '#111827',
    textSecondary: '#374151',
    textMuted: '#6b7280',
    sidebarBg: '#0b2545',
    sidebarBg2: '#12355b',
    sidebarText: '#f8fafc',
    sidebarMuted: '#b7c4d6',
    sidebarActiveAccent: '#c99700',
  },
};

const THEME_COLOR_KEYS = Object.keys(DEFAULT_THEME.colors);

const normalizeTheme = (value = {}) => {
  const sourceColors = value && typeof value === 'object' ? value.colors || {} : {};
  const colors = { ...DEFAULT_THEME.colors };

  for (const key of THEME_COLOR_KEYS) {
    if (typeof sourceColors[key] === 'string') {
      colors[key] = sourceColors[key];
    }
  }

  return { colors };
};

module.exports = {
  DEFAULT_THEME,
  THEME_COLOR_KEYS,
  THEME_SETTING_KEY,
  normalizeTheme,
};
