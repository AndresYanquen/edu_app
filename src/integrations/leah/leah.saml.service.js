const crypto = require("crypto");
const samlify = require("samlify");
const pool = require("../../db");
const { getLeahSamlConfig } = require("./leah.config");

samlify.setSchemaValidator({
  validate: () => Promise.resolve("skipped"),
});

const SAML_POST_BINDING = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST";
const SAML_POST_BINDING_KEY = "post";
const NAME_ID_FORMAT = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress";

const hashToken = (token) =>
  crypto.createHash("sha256").update(token, "utf8").digest("hex");

const samlId = () => `_${crypto.randomUUID().replace(/-/g, "")}`;

const splitFullName = (fullName = "") => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildServiceProviderMetadata = ({ audience, acsUrl }) => `
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${escapeHtml(audience)}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" WantAssertionsSigned="true">
    <NameIDFormat>${NAME_ID_FORMAT}</NameIDFormat>
    <AssertionConsumerService Binding="${SAML_POST_BINDING}" Location="${escapeHtml(acsUrl)}" index="0" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;

const buildLoginResponseTemplate = ({ notBefore, notOnOrAfter }) =>
  samlify.SamlLib.defaultLoginResponseTemplate.context
    .replace("{ConditionsNotBefore}", notBefore)
    .replace("{ConditionsNotOnOrAfter}", notOnOrAfter)
    .replace("{SubjectConfirmationDataNotOnOrAfter}", notOnOrAfter);

const buildEntities = (templateTimes = {}) => {
  const config = getLeahSamlConfig();
  const loginResponseContext = templateTimes.notBefore && templateTimes.notOnOrAfter
    ? buildLoginResponseTemplate(templateTimes)
    : samlify.SamlLib.defaultLoginResponseTemplate.context;
  const idp = samlify.IdentityProvider({
    entityID: config.entityId,
    privateKey: config.privateKey,
    signingCert: config.certificateBody,
    nameIDFormat: [NAME_ID_FORMAT],
    singleSignOnService: [{
      Binding: SAML_POST_BINDING,
      Location: config.ssoUrl,
    }],
    loginResponseTemplate: {
      context: loginResponseContext,
      attributes: [
        { name: "email", valueTag: "email" },
        { name: "firstName", valueTag: "firstName" },
        { name: "lastName", valueTag: "lastName" },
        { name: "externalId", valueTag: "externalId" },
      ],
    },
    generateID: samlId,
  });
  const sp = samlify.ServiceProvider({
    metadata: buildServiceProviderMetadata(config),
  });
  return { idp, sp, config };
};

const createLeahSsoSession = async (userId) => {
  const config = getLeahSamlConfig();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.tokenTtlSeconds * 1000);
  await pool.query(
    `
      INSERT INTO leah_saml_sso_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [userId, hashToken(token), expiresAt.toISOString()],
  );
  return {
    token,
    loginUrl: `/integrations/leah/saml/login?token=${encodeURIComponent(token)}`,
    expiresAt: expiresAt.toISOString(),
  };
};

const consumeLeahSsoToken = async (token) => {
  if (!token) return null;
  const { rows } = await pool.query(
    `
      UPDATE leah_saml_sso_tokens
      SET consumed_at = now()
      WHERE token_hash = $1
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING user_id
    `,
    [hashToken(token)],
  );
  return rows[0]?.user_id || null;
};

const getSamlUser = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT id, email, full_name
      FROM users
      WHERE id = $1
        AND is_active = true
        AND must_set_password = false
      LIMIT 1
    `,
    [userId],
  );
  const user = rows[0];
  if (!user) return null;
  const { firstName, lastName } = splitFullName(user.full_name);
  return {
    id: user.id,
    email: user.email,
    firstName,
    lastName,
    externalId: user.id,
  };
};

const getMetadataXml = () => {
  const { idp } = buildEntities();
  return idp.getMetadata();
};

const createLeahLoginResponse = async (user) => {
  const now = new Date();
  const notBefore = new Date(now.getTime() - 30 * 1000).toISOString();
  const { assertionTtlSeconds } = getLeahSamlConfig();
  const notOnOrAfter = new Date(now.getTime() + assertionTtlSeconds * 1000).toISOString();
  const { idp, sp, config } = buildEntities({ notBefore, notOnOrAfter });
  const requestInfo = {
    extract: {
      request: {
        id: samlId(),
      },
    },
  };
  const response = await idp.createLoginResponse(
    sp,
    requestInfo,
    SAML_POST_BINDING_KEY,
    {
      email: user.email,
      nameID: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      externalId: user.externalId,
    },
  );

  return {
    samlResponse: response.context,
    acsUrl: config.acsUrl,
    environment: config.environment,
  };
};

const renderAutoPostHtml = ({ acsUrl, samlResponse }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Redirecting to Leah</title>
  </head>
  <body>
    <form id="saml-form" method="POST" action="${escapeHtml(acsUrl)}">
      <input type="hidden" name="SAMLResponse" value="${escapeHtml(samlResponse)}">
      <noscript>
        <button type="submit">Continue to Leah</button>
      </noscript>
    </form>
    <script>document.getElementById('saml-form').submit();</script>
  </body>
</html>`;

module.exports = {
  createLeahLoginResponse,
  createLeahSsoSession,
  consumeLeahSsoToken,
  getMetadataXml,
  getSamlUser,
  renderAutoPostHtml,
};
