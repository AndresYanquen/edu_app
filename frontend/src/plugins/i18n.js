import { createI18n } from 'vue-i18n';
import en from '../locales/en';
import es from '../locales/es';

const messages = { en, es };
const storedLocale =
  typeof window !== 'undefined' ? window.localStorage.getItem('app:locale') : null;
const defaultLocale = storedLocale || 'en';

const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: 'en',
  messages,
});

export default i18n;
