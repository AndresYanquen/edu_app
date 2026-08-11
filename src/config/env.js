const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const PLACEHOLDER_SECRET_PATTERN =
  /^(replace-with-strong-secret|change-me|changeme|secret|password|default|jwt-secret|your-secret)$/i;

const integerEnv = (name, { min, max, defaultValue } = {}) => {
  let schema = z.number({
    required_error: `${name} is required`,
    invalid_type_error: `${name} must be an integer`,
  }).int(`${name} must be an integer`);

  if (min !== undefined) {
    schema = schema.min(min, `${name} must be greater than or equal to ${min}`);
  }
  if (max !== undefined) {
    schema = schema.max(max, `${name} must be less than or equal to ${max}`);
  }
  if (defaultValue !== undefined) {
    schema = schema.default(defaultValue);
  }

  return z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') return undefined;
      const parsed = Number(value);
      return Number.isInteger(parsed) ? parsed : value;
    },
    schema,
  );
};

const urlSchema = (name) =>
  z.string().url(`${name} must be a valid URL`);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: urlSchema('DATABASE_URL'),
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET must be at least 32 characters')
      .refine((value) => !PLACEHOLDER_SECRET_PATTERN.test(value.trim()), {
        message: 'JWT_SECRET must not be a placeholder value',
      }),
    FRONTEND_ORIGIN: urlSchema('FRONTEND_ORIGIN'),
    STORAGE_PROVIDER: z.enum(['r2']).default('r2'),
    ACCESS_TOKEN_TTL_MIN: integerEnv('ACCESS_TOKEN_TTL_MIN', { min: 1, max: 60, defaultValue: 10 }),
    REFRESH_TOKEN_TTL_DAYS: integerEnv('REFRESH_TOKEN_TTL_DAYS', { min: 1, max: 90, defaultValue: 14 }),
    AUTH_RATE_LIMIT_WINDOW_MS: integerEnv('AUTH_RATE_LIMIT_WINDOW_MS', { min: 1000, defaultValue: 15 * 60 * 1000 }),
    AUTH_RATE_LIMIT_MAX: integerEnv('AUTH_RATE_LIMIT_MAX', { min: 1, defaultValue: 30 }),
    ADMIN_BULK_INVITE_RATE_LIMIT_WINDOW_MS: integerEnv('ADMIN_BULK_INVITE_RATE_LIMIT_WINDOW_MS', {
      min: 1000,
      defaultValue: 60 * 1000,
    }),
    ADMIN_BULK_INVITE_RATE_LIMIT_MAX: integerEnv('ADMIN_BULK_INVITE_RATE_LIMIT_MAX', { min: 1, defaultValue: 5 }),
    PORT: integerEnv('PORT', { min: 1, max: 65535, defaultValue: 3000 }),
    SERVER_REQUEST_TIMEOUT_MS: integerEnv('SERVER_REQUEST_TIMEOUT_MS', { min: 1000, defaultValue: 15_000 }),
    SERVER_HEADERS_TIMEOUT_MS: integerEnv('SERVER_HEADERS_TIMEOUT_MS', { min: 1000, defaultValue: 10_000 }),
    SERVER_KEEP_ALIVE_TIMEOUT_MS: integerEnv('SERVER_KEEP_ALIVE_TIMEOUT_MS', { min: 1000, defaultValue: 5_000 }),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_PRESIGNED_TTL_SECONDS: integerEnv('R2_PRESIGNED_TTL_SECONDS', { min: 60, max: 900, defaultValue: 5 * 60 }),
    R2_DOWNLOAD_TTL_SECONDS: integerEnv('R2_DOWNLOAD_TTL_SECONDS', { min: 60, max: 900, defaultValue: 5 * 60 }),
    JSON_BODY_LIMIT: z.string().default('1mb'),
    URLENCODED_BODY_LIMIT: z.string().default('1mb'),
    ENABLE_PUBLIC_LOCAL_UPLOADS: z.enum(['true', 'false']).default('false'),
    MAX_IMAGE_UPLOAD_MB: integerEnv('MAX_IMAGE_UPLOAD_MB', { min: 1, max: 50, defaultValue: 10 }),
    MAX_DOCUMENT_UPLOAD_MB: integerEnv('MAX_DOCUMENT_UPLOAD_MB', { min: 1, max: 100, defaultValue: 25 }),
    MAX_AUDIO_UPLOAD_MB: integerEnv('MAX_AUDIO_UPLOAD_MB', { min: 1, max: 250, defaultValue: 50 }),
    IMAGE_MAX_WIDTH: integerEnv('IMAGE_MAX_WIDTH', { min: 320, max: 4096, defaultValue: 1600 }),
    IMAGE_WEBP_QUALITY: integerEnv('IMAGE_WEBP_QUALITY', { min: 1, max: 100, defaultValue: 82 }),
    USER_INVITE_TTL_DAYS: integerEnv('USER_INVITE_TTL_DAYS', { min: 1, max: 30, defaultValue: 7 }),
    PRESENCE_ONLINE_TTL_SECONDS: integerEnv('PRESENCE_ONLINE_TTL_SECONDS', { min: 5, max: 3600, defaultValue: 60 }),
    GAMIFICATION_STREAK_TIMEZONE: z.string().default('America/Bogota'),
    QUENTLI_API_URL: z.string().url('QUENTLI_API_URL must be a valid URL').optional(),
    QUENTLI_API_TOKEN: z.string().optional(),
    ZOOM_API_BASE_URL: z.string().url('ZOOM_API_BASE_URL must be a valid URL').default('https://api.zoom.us/v2'),
    ZOOM_OAUTH_TOKEN_URL: z.string().url('ZOOM_OAUTH_TOKEN_URL must be a valid URL').default('https://zoom.us/oauth/token'),
    ZOOM_ACCOUNT_ID: z.string().optional(),
    ZOOM_CLIENT_ID: z.string().optional(),
    ZOOM_CLIENT_SECRET: z.string().optional(),
    API_PUBLIC_ORIGIN: z.string().url('API_PUBLIC_ORIGIN must be a valid URL').optional(),
    LEAH_SAML_ENV: z.enum(['staging', 'production']).default('staging'),
    LEAH_SAML_ENTITY_ID: z.string().optional(),
    LEAH_SAML_SSO_URL: z.string().url('LEAH_SAML_SSO_URL must be a valid URL').optional(),
    LEAH_SAML_CERT_PATH: z.string().optional(),
    LEAH_SAML_PRIVATE_KEY_PATH: z.string().optional(),
    LEAH_SAML_STAGING_ACS: z
      .string()
      .url('LEAH_SAML_STAGING_ACS must be a valid URL')
      .default('https://staging-account.leahapp.com/saml2/idpresponse'),
    LEAH_SAML_STAGING_AUDIENCE: z
      .string()
      .default('urn:amazon:cognito:sp:us-east-1_T2SfG3e7x'),
    LEAH_SAML_PRODUCTION_ACS: z
      .string()
      .url('LEAH_SAML_PRODUCTION_ACS must be a valid URL')
      .default('https://account.leahapp.com/saml2/idpresponse'),
    LEAH_SAML_PRODUCTION_AUDIENCE: z
      .string()
      .default('urn:amazon:cognito:sp:us-east-1_b1zQqXzwm'),
    LEAH_SAML_TOKEN_TTL_SECONDS: integerEnv('LEAH_SAML_TOKEN_TTL_SECONDS', {
      min: 30,
      max: 300,
      defaultValue: 120,
    }),
    LEAH_SAML_ASSERTION_TTL_SECONDS: integerEnv('LEAH_SAML_ASSERTION_TTL_SECONDS', {
      min: 60,
      max: 600,
      defaultValue: 300,
    }),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_PROVIDER === 'r2') {
      for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_PROVIDER=r2`,
          });
        }
      }

      if (env.R2_BUCKET && (env.R2_BUCKET.includes('/') || env.R2_BUCKET.startsWith('http'))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['R2_BUCKET'],
          message: 'R2_BUCKET must be the bucket name only, not the R2 endpoint URL',
        });
      }
    }

    if (env.QUENTLI_API_URL && !env.QUENTLI_API_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['QUENTLI_API_TOKEN'],
        message: 'QUENTLI_API_TOKEN is required when QUENTLI_API_URL is set',
      });
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'ENV'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

module.exports = result.data;
