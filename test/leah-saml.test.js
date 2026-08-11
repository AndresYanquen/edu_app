const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/test";
process.env.JWT_SECRET = "leah-saml-test-secret-with-32-plus-chars";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.STORAGE_PROVIDER = "r2";
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret";
process.env.R2_BUCKET = "test-bucket";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "leah-saml-"));
const keyPath = path.join(tmpDir, "idp.key");
const certPath = path.join(tmpDir, "idp.crt");

execFileSync("openssl", [
  "req",
  "-x509",
  "-newkey",
  "rsa:2048",
  "-keyout",
  keyPath,
  "-out",
  certPath,
  "-days",
  "1",
  "-nodes",
  "-subj",
  "/CN=academy-test-idp",
], { stdio: "ignore" });

process.env.API_PUBLIC_ORIGIN = "https://api.academy.test";
process.env.LEAH_SAML_CERT_PATH = certPath;
process.env.LEAH_SAML_PRIVATE_KEY_PATH = keyPath;

const clearLeahModules = () => {
  [
    "../src/config/env",
    "../src/integrations/leah/leah.config",
    "../src/integrations/leah/leah.saml.service",
  ].forEach((modulePath) => {
    delete require.cache[require.resolve(modulePath)];
  });
};

const loadService = (environment = "staging") => {
  process.env.LEAH_SAML_ENV = environment;
  clearLeahModules();
  return require("../src/integrations/leah/leah.saml.service");
};

const decodeSamlResponse = (value) => Buffer.from(value, "base64").toString("utf8");

test("Leah metadata exposes IdP XML without private key", () => {
  const { getMetadataXml } = loadService("staging");
  const metadata = getMetadataXml();
  assert.match(metadata, /EntityDescriptor/);
  assert.match(metadata, /IDPSSODescriptor/);
  assert.match(metadata, /https:\/\/api\.academy\.test\/integrations\/leah\/saml\/login/);
  assert.doesNotMatch(metadata, /PRIVATE KEY/);
});

test("Leah staging SAML response uses staging ACS, audience, email and expiration", async () => {
  const { createLeahLoginResponse } = loadService("staging");
  const result = await createLeahLoginResponse({
    id: "11111111-1111-4111-8111-111111111111",
    externalId: "11111111-1111-4111-8111-111111111111",
    email: "student@example.com",
    firstName: "Student",
    lastName: "One",
  });
  const xml = decodeSamlResponse(result.samlResponse);
  assert.equal(result.acsUrl, "https://staging-account.leahapp.com/saml2/idpresponse");
  assert.match(xml, /urn:amazon:cognito:sp:us-east-1_T2SfG3e7x/);
  assert.match(xml, /student@example\.com/);
  assert.match(xml, /NotOnOrAfter=/);
  assert.doesNotMatch(xml, /PRIVATE KEY/);
});

test("Leah production SAML response uses production ACS and audience", async () => {
  const { createLeahLoginResponse } = loadService("production");
  const result = await createLeahLoginResponse({
    id: "11111111-1111-4111-8111-111111111111",
    externalId: "11111111-1111-4111-8111-111111111111",
    email: "student@example.com",
    firstName: "Student",
    lastName: "One",
  });
  const xml = decodeSamlResponse(result.samlResponse);
  assert.equal(result.acsUrl, "https://account.leahapp.com/saml2/idpresponse");
  assert.match(xml, /urn:amazon:cognito:sp:us-east-1_b1zQqXzwm/);
});

test("Leah SAML responses generate unique response and assertion ids", async () => {
  const { createLeahLoginResponse } = loadService("staging");
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    externalId: "11111111-1111-4111-8111-111111111111",
    email: "student@example.com",
    firstName: "Student",
    lastName: "One",
  };
  const first = decodeSamlResponse((await createLeahLoginResponse(user)).samlResponse);
  const second = decodeSamlResponse((await createLeahLoginResponse(user)).samlResponse);
  const firstResponseId = first.match(/<samlp:Response[^>]+ID="([^"]+)"/)?.[1];
  const secondResponseId = second.match(/<samlp:Response[^>]+ID="([^"]+)"/)?.[1];
  const firstAssertionId = first.match(/<saml:Assertion[^>]+ID="([^"]+)"/)?.[1];
  const secondAssertionId = second.match(/<saml:Assertion[^>]+ID="([^"]+)"/)?.[1];
  assert.ok(firstResponseId);
  assert.ok(firstAssertionId);
  assert.notEqual(firstResponseId, secondResponseId);
  assert.notEqual(firstAssertionId, secondAssertionId);
});
