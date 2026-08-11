const express = require("express");
const auth = require("../../middleware/auth");
const {
  createLeahLoginResponse,
  createLeahSsoSession,
  consumeLeahSsoToken,
  getMetadataXml,
  getSamlUser,
  renderAutoPostHtml,
} = require("./leah.saml.service");

const router = express.Router();

const handleConfigError = (res, err) => {
  if (err.code === "LEAH_SAML_CONFIG_MISSING") {
    return res.status(503).json({ error: "Leah SAML is not configured" });
  }
  console.error("Leah SAML error", err);
  return res.status(500).json({ error: "Failed to process Leah SAML request" });
};

router.get("/saml/metadata", (req, res) => {
  try {
    res.type("application/xml").send(getMetadataXml());
  } catch (err) {
    return handleConfigError(res, err);
  }
});

router.post("/saml/session", auth, async (req, res) => {
  try {
    const session = await createLeahSsoSession(req.user.id);
    console.info("Leah SAML session created", {
      provider: "leah",
      userId: req.user.id,
      expiresAt: session.expiresAt,
    });
    return res.status(201).json({
      loginUrl: session.loginUrl,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    return handleConfigError(res, err);
  }
});

router.get("/saml/login", async (req, res) => {
  try {
    const userId = await consumeLeahSsoToken(String(req.query.token || ""));
    if (!userId) {
      return res.status(401).send("Invalid or expired Leah SSO token");
    }

    const user = await getSamlUser(userId);
    if (!user) {
      return res.status(401).send("User cannot access Leah SSO");
    }
    if (!user.email) {
      return res.status(400).send("User email is required for Leah SSO");
    }

    const loginResponse = await createLeahLoginResponse(user);
    console.info("Leah SAML response generated", {
      provider: "leah",
      environment: loginResponse.environment,
      userId,
      timestamp: new Date().toISOString(),
    });
    return res.type("html").send(renderAutoPostHtml(loginResponse));
  } catch (err) {
    if (err.code === "LEAH_SAML_CONFIG_MISSING") {
      return res.status(503).send("Leah SAML is not configured");
    }
    console.error("Failed to generate Leah SAML login", err);
    return res.status(500).send("Failed to start Leah SSO");
  }
});

module.exports = router;
