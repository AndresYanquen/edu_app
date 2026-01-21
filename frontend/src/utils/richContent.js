import DOMPurify from 'dompurify';

const URL_REGEX = /(https?:\/\/[^\s<]+)/gi;
const TRAILING_PUNCTUATION = /[),.;!?]+$/;
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a'];
const FILE_EXTENSION_LABELS = new Map([['.pdf', 'PDF']]);
const EMBED_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'player.vimeo.com',
  'vimeo.com',
  'www.vimeo.com',
  'www.loom.com',
  'loom.com',
]);

const sanitizeContent = (value) => {
  if (!value) return '';
  return DOMPurify.sanitize(value);
};

const htmlToPlainText = (value) => {
  if (!value) return '';
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return value;
  }
  const parser = new window.DOMParser();
  const doc = parser.parseFromString(value, 'text/html');
  const segments = [];

  const pushText = (text) => {
    if (!text) return;
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized) {
      segments.push(normalized);
    }
  };

  const pushUrl = (url) => {
    if (!url) return;
    segments.push(`\n${url}\n`);
  };

  const extractNode = (node) => {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.nodeValue);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const tag = node.tagName.toUpperCase();
    if ((tag === 'IMG' || tag === 'IMAGE') && node.getAttribute('src')) {
      pushUrl(node.getAttribute('src'));
    } else if (tag === 'AUDIO' && node.getAttribute('src')) {
      pushUrl(node.getAttribute('src'));
    } else if (tag === 'A' && node.getAttribute('href')) {
      pushUrl(node.getAttribute('href'));
    }
    node.childNodes.forEach((child) => extractNode(child));
    if (['P', 'DIV', 'BR', 'SECTION', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3'].includes(tag)) {
      segments.push('\n');
    }
  };

  extractNode(doc.body);
  return segments
    .join(' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
};

const splitTextBlock = (blocks, value) => {
  if (!value) {
    return;
  }
  blocks.push({ type: 'text', value });
};

const normalizeUrlForExtension = (rawUrl) => rawUrl.split(/[?#]/)[0].toLowerCase();

const isImageUrl = (rawUrl) => {
  const lower = rawUrl.split('?')[0].toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

const isAudioUrl = (rawUrl) => {
  const lower = normalizeUrlForExtension(rawUrl);
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

const getFileLabel = (rawUrl) => {
  const lower = normalizeUrlForExtension(rawUrl);
  const extensionMatch = lower.match(/\.[a-z0-9]+$/);
  if (!extensionMatch) return null;
  return FILE_EXTENSION_LABELS.get(extensionMatch[0]) || null;
};

const buildYoutubeEmbed = (parsed) => {
  const host = parsed.hostname.toLowerCase();
  if (host.includes('youtube.com')) {
    const videoId = parsed.searchParams.get('v');
    if (videoId) {
      return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
    }
    const pathId = parsed.pathname.split('/').pop();
    if (pathId) {
      return `https://www.youtube.com/embed/${encodeURIComponent(pathId)}`;
    }
  }
  if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
    const id = parsed.pathname.replace('/', '');
    if (id) {
      return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    }
  }
  return null;
};

const buildVimeoEmbed = (parsed) => {
  const pathMatch = parsed.pathname.match(/\/(\d+)/);
  if (pathMatch && pathMatch[1]) {
    return `https://player.vimeo.com/video/${pathMatch[1]}`;
  }
  return null;
};

const buildLoomEmbed = (parsed) => {
  const parts = parsed.pathname.split('/');
  const shareIndex = parts.indexOf('share');
  if (shareIndex >= 0 && parts[shareIndex + 1]) {
    return `https://www.loom.com/embed/${parts[shareIndex + 1]}`;
  }
  return null;
};

const classifyUrl = (rawUrl) => {
  if (!rawUrl) {
    return null;
  }
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();

    if (isImageUrl(rawUrl)) {
      return { type: 'image', url: rawUrl };
    }

    if (isAudioUrl(rawUrl)) {
      return { type: 'audio', url: rawUrl };
    }

    if (host.includes('youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be')) {
      const embedUrl = buildYoutubeEmbed(parsed);
      if (embedUrl && EMBED_HOSTS.has(new URL(embedUrl).hostname)) {
        return {
          type: 'embed',
          provider: 'youtube',
          url: rawUrl,
          embedUrl,
        };
      }
    }

    if (host.includes('vimeo.com')) {
      const embedUrl = buildVimeoEmbed(parsed);
      if (embedUrl) {
        return {
          type: 'embed',
          provider: 'vimeo',
          url: rawUrl,
          embedUrl,
        };
      }
    }

    if (host.includes('loom.com')) {
      const embedUrl = buildLoomEmbed(parsed);
      if (embedUrl) {
        return {
          type: 'embed',
          provider: 'loom',
          url: rawUrl,
          embedUrl,
        };
      }
    }

    const fileLabel = getFileLabel(rawUrl);
    if (fileLabel) {
      return { type: 'file', url: rawUrl, label: fileLabel };
    }

    const allowed = EMBED_HOSTS.has(host);
    if (!allowed) {
      return { type: 'link', url: rawUrl };
    }
    return { type: 'link', url: rawUrl };
  } catch {
    return null;
  }
};

export const parseRichContent = (text = '') => {
  const sanitized = sanitizeContent(text);
  const normalized = htmlToPlainText(sanitized || text);
  if (!normalized) {
    return [];
  }
  const blocks = [];
  let lastIndex = 0;

  const matches = [...normalized.matchAll(URL_REGEX)];
  matches.forEach((match) => {
    const matchStart = match.index || 0;
    if (matchStart > lastIndex) {
      splitTextBlock(blocks, normalized.slice(lastIndex, matchStart));
    }

    let url = match[0];
    if (!url) {
      return;
    }
    const trailingMatch = url.match(TRAILING_PUNCTUATION);
    if (trailingMatch) {
      url = url.slice(0, url.length - trailingMatch[0].length);
    }

    const block = classifyUrl(url);
    if (block) {
      blocks.push(block);
    } else {
      splitTextBlock(blocks, url);
    }

    lastIndex = matchStart + (url.length || 0);
  });

  if (lastIndex < normalized.length) {
    splitTextBlock(blocks, normalized.slice(lastIndex));
  }

  return blocks.filter((block) => {
    if (block.type !== 'text') return true;
    return block.value.trim().length > 0;
  });
};

export default parseRichContent;
