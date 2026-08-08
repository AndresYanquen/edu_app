const sharp = require('sharp');

const DEFAULT_MAX_WIDTH = 1600;
const DEFAULT_WEBP_QUALITY = 82;

const IMAGE_PROCESSING_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const getImageProcessingConfig = () => {
  const maxWidth = Number(process.env.IMAGE_MAX_WIDTH || DEFAULT_MAX_WIDTH);
  const quality = Number(process.env.IMAGE_WEBP_QUALITY || DEFAULT_WEBP_QUALITY);

  return {
    maxWidth: Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : DEFAULT_MAX_WIDTH,
    quality: Number.isFinite(quality) && quality > 0 && quality <= 100 ? quality : DEFAULT_WEBP_QUALITY,
  };
};

const canConvertToWebp = (mimeType) => IMAGE_PROCESSING_MIME_TYPES.has(mimeType);

const getWebpFileName = (fileName = 'image') => {
  const baseName = String(fileName || 'image').replace(/\.[^.]+$/, '') || 'image';
  return `${baseName}.webp`;
};

const convertImageToWebp = async ({ buffer, originalName, mimeType } = {}) => {
  if (!buffer || !canConvertToWebp(mimeType)) {
    return null;
  }

  const { maxWidth, quality } = getImageProcessingConfig();
  const pipeline = sharp(buffer, { failOn: 'none' }).rotate();
  const metadata = await pipeline.metadata();
  const shouldResize = metadata.width && metadata.width > maxWidth;

  if (shouldResize) {
    pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }

  const output = await pipeline.webp({ quality }).toBuffer();

  return {
    buffer: output,
    mimeType: 'image/webp',
    originalName: originalName || 'image',
    fileName: getWebpFileName(originalName),
    sizeBytes: output.length,
    width: shouldResize ? maxWidth : metadata.width || null,
    height: metadata.height || null,
  };
};

module.exports = {
  canConvertToWebp,
  convertImageToWebp,
  getWebpFileName,
};
