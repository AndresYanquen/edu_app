export const DEFAULT_THEME = {
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

export const THEME_COLOR_TOKEN_MAP = {
  brandPrimary: '--brand-primary',
  brandPrimaryHover: '--brand-primary-hover',
  brandPrimarySoft: '--brand-primary-soft',
  brandAccent: '--brand-accent',
  brandAccentStrong: '--brand-accent-strong',
  brandAccentSoft: '--brand-accent-soft',
  appBg: '--app-bg',
  appSurface: '--app-surface',
  appSurface2: '--app-surface-2',
  appBorder: '--app-border',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  sidebarBg: '--sidebar-bg',
  sidebarBg2: '--sidebar-bg-2',
  sidebarText: '--sidebar-text',
  sidebarMuted: '--sidebar-muted',
  sidebarActiveAccent: '--sidebar-active-accent',
};

const HEX_COLOR_REGEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const normalizeTheme = (theme = {}) => {
  const colors = { ...DEFAULT_THEME.colors };

  Object.keys(THEME_COLOR_TOKEN_MAP).forEach((key) => {
    const value = theme?.colors?.[key];
    if (typeof value === 'string' && HEX_COLOR_REGEX.test(value)) {
      colors[key] = value;
    }
  });

  return { colors };
};

export const applyTheme = (theme = {}) => {
  if (typeof document === 'undefined') return;

  const normalized = normalizeTheme(theme);
  Object.entries(THEME_COLOR_TOKEN_MAP).forEach(([key, token]) => {
    document.documentElement.style.setProperty(token, normalized.colors[key]);
  });
};
