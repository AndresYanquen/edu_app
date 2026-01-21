import { supabaseClient } from './supabase';

const BUCKET = 'Academy_storage';
const KIND_NORMALIZATION = {
  image: 'image',
  images: 'image',
  audio: 'audio',
  file: 'file',
  files: 'file',
};

const KIND_FOLDER = {
  image: 'images',
  audio: 'audio',
  file: 'files',
};

const sanitizeFileName = (value) => {
  if (!value) return '';
  const normalized = value
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '');
  return normalized || 'asset';
};

const buildAssetPath = ({ courseId, lessonId, kind, file }) => {
  const folder = KIND_FOLDER[kind] || KIND_FOLDER.file;
  const safeName = sanitizeFileName(file.name);
  const timestamp = Date.now();
  return `courses/${courseId}/lessons/${lessonId}/${folder}/${timestamp}-${safeName}`;
};

const ensurePublicUrl = async (path) => {
  const { data: publicData } = supabaseClient.storage.from(BUCKET).getPublicUrl(path);
  let publicUrl = publicData?.publicUrl;
  if (!publicUrl) {
    const { data: signedData, error: signedError } = await supabaseClient.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (signedError) {
      throw signedError;
    }
    publicUrl = signedData?.signedUrl;
  }
  return publicUrl;
};

export const uploadLessonAsset = async ({ courseId, lessonId, file, kind }) => {
  if (!courseId || !lessonId) {
    throw new Error('Course and lesson IDs are required to upload assets');
  }
  if (!file) {
    throw new Error('No file provided for upload');
  }
  const normalizedKind = KIND_NORMALIZATION[kind] || 'file';
  const path = buildAssetPath({ courseId, lessonId, kind: normalizedKind, file });
  const { error: uploadError } = await supabaseClient.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
  if (uploadError) {
    throw uploadError;
  }

  const publicUrl = await ensurePublicUrl(path);

  return {
    path: `${BUCKET}/${path}`,
    publicUrl,
    mimeType: file.type,
    size: file.size,
    originalName: file.name,
    kind: normalizedKind,
  };
};
