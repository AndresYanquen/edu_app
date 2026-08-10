const { S3Client, HeadObjectCommand, DeleteObjectCommand, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../../config/env');

const DEFAULT_UPLOAD_TTL_SECONDS = 5 * 60;
const DEFAULT_DOWNLOAD_TTL_SECONDS = 5 * 60;

let client;

const getClient = () => {
  if (client) return client;

  const accountId = env.R2_ACCOUNT_ID;
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  return client;
};

const getBucket = () => {
  return env.R2_BUCKET;
};

const createUploadUrl = async ({ key, mimeType, sizeBytes, expiresIn } = {}) => {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: mimeType,
  });

  return getSignedUrl(getClient(), command, {
    expiresIn: expiresIn || env.R2_PRESIGNED_TTL_SECONDS || DEFAULT_UPLOAD_TTL_SECONDS,
  });
};

const putObject = async ({ key, body, mimeType, metadata } = {}) => {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: mimeType,
      Metadata: metadata,
    }),
  );
};

const createDownloadUrl = async ({ key, expiresIn } = {}) => {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });

  return getSignedUrl(getClient(), command, {
    expiresIn: expiresIn || env.R2_DOWNLOAD_TTL_SECONDS || DEFAULT_DOWNLOAD_TTL_SECONDS,
  });
};

const headObject = async ({ key } = {}) =>
  getClient().send(
    new HeadObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );

const getObjectBuffer = async ({ key } = {}) => {
  const response = await getClient().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );

  return Buffer.from(await response.Body.transformToByteArray());
};

const deleteObject = async ({ key } = {}) => {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );
};

const objectExists = async ({ key } = {}) => {
  try {
    await headObject({ key });
    return true;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
      return false;
    }
    throw err;
  }
};

module.exports = {
  createUploadUrl,
  putObject,
  createDownloadUrl,
  deleteObject,
  headObject,
  getObjectBuffer,
  objectExists,
};
