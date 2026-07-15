import { computed, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const ZENDESK_SCRIPT_ID = 'ze-snippet';
const ZENDESK_SCRIPT_SRC =
  'https://static.zdassets.com/ekr/snippet.js?key=b0beef9e-4ef7-4174-abae-412ffd0d0ce8';

const ZENDESK_SELECTORS = [
  `script#${ZENDESK_SCRIPT_ID}`,
  'iframe[src*="zendesk"]',
  'iframe[src*="zdassets"]',
  'iframe[title*="Zendesk"]',
  'iframe[title*="zendesk"]',
  '#webWidget',
  '[id^="webWidget"]',
  '[id^="launcher"]',
  '[data-product="web_widget"]',
];

const callZendesk = (...args) => {
  if (typeof window === 'undefined' || typeof window.zE !== 'function') return;

  try {
    window.zE(...args);
  } catch (err) {
    // Zendesk may expose either Web Widget Classic or Messenger APIs.
  }
};

const cleanupZendeskGlobals = () => {
  if (typeof window === 'undefined') return;

  try {
    delete window.zE;
  } catch (err) {
    window.zE = undefined;
  }

  try {
    delete window.zESettings;
  } catch (err) {
    window.zESettings = undefined;
  }
};

const removeZendeskWidget = () => {
  if (typeof document === 'undefined') return;

  callZendesk('webWidget', 'hide');
  callZendesk('webWidget', 'close');
  callZendesk('webWidget', 'reset');
  callZendesk('messenger', 'close');
  callZendesk('messenger', 'hide');

  ZENDESK_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.remove();
    });
  });

  cleanupZendeskGlobals();
};

const loadZendeskWidget = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(ZENDESK_SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = ZENDESK_SCRIPT_ID;
  script.src = ZENDESK_SCRIPT_SRC;
  script.async = true;
  document.body.appendChild(script);
};

export const useZendeskWidget = () => {
  const auth = useAuthStore();
  const route = useRoute();

  const shouldShowZendesk = computed(() => {
    const routeRoles = Array.isArray(route.meta?.roles) ? route.meta.roles : [];

    return (
      auth.initialized &&
      auth.isAuthenticated &&
      auth.hasRole('student') &&
      routeRoles.includes('student') &&
      !route.meta?.public &&
      !route.meta?.requiresAdmin &&
      !route.meta?.requiresStaff
    );
  });

  watch(
    shouldShowZendesk,
    (enabled) => {
      if (enabled) {
        loadZendeskWidget();
        return;
      }

      removeZendeskWidget();
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    removeZendeskWidget();
  });
};
