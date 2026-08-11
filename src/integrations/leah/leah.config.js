const fs = require("fs");
const env = require("../../config/env");

const LEAH_STAGING_ACS = "https://staging-account.leahapp.com/saml2/idpresponse";
const LEAH_STAGING_AUDIENCE = "urn:amazon:cognito:sp:us-east-1_T2SfG3e7x";
const LEAH_PRODUCTION_ACS = "https://account.leahapp.com/saml2/idpresponse";
const LEAH_PRODUCTION_AUDIENCE = "urn:amazon:cognito:sp:us-east-1_b1zQqXzwm";

const trimPemCertificate = (cert = "") =>
  cert
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

const readRequiredFile = (filePath, label) => {
  if (!filePath) {
    const error = new Error(`${label} path is not configured`);
    error.code = "LEAH_SAML_CONFIG_MISSING";
    throw error;
  }
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    const error = new Error(`${label} file could not be read`);
    error.code = "LEAH_SAML_CONFIG_MISSING";
    throw error;
  }
};

const getLeahSamlConfig = () => {
  const environment = env.LEAH_SAML_ENV;
  const isProduction = environment === "production";
  const acsUrl = isProduction ? env.LEAH_SAML_PRODUCTION_ACS : env.LEAH_SAML_STAGING_ACS;
  const audience = isProduction
    ? env.LEAH_SAML_PRODUCTION_AUDIENCE
    : env.LEAH_SAML_STAGING_AUDIENCE;
  const publicOrigin = env.API_PUBLIC_ORIGIN || env.FRONTEND_ORIGIN;
  const ssoUrl = env.LEAH_SAML_SSO_URL || `${publicOrigin}/integrations/leah/saml/login`;
  const entityId = env.LEAH_SAML_ENTITY_ID || `${publicOrigin}/integrations/leah/saml/metadata`;
  const certificate = readRequiredFile(env.LEAH_SAML_CERT_PATH, "LEAH SAML certificate");
  const privateKey = readRequiredFile(env.LEAH_SAML_PRIVATE_KEY_PATH, "LEAH SAML private key");

  return {
    environment,
    entityId,
    ssoUrl,
    acsUrl,
    audience,
    certificate,
    certificateBody: trimPemCertificate(certificate),
    privateKey,
    tokenTtlSeconds: env.LEAH_SAML_TOKEN_TTL_SECONDS,
    assertionTtlSeconds: env.LEAH_SAML_ASSERTION_TTL_SECONDS,
  };
};

module.exports = {
  getLeahSamlConfig,
};
