/**
 * BTP iFlow Manager — Backend API Proxy
 *
 * On Cloud Foundry:
 *   Credentials are injected automatically via VCAP_SERVICES (Destination Service).
 *   Nothing is hardcoded — no .env needed in production.
 *
 * Locally (development):
 *   Copy proxy/.env.example → proxy/.env and fill in your values.
 *   Run: node server.js
 */

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import FormData from "form-data";
import multer from "multer";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// ─── CORS: allow React dev server locally, locked down on CF ─────────────────
const isDev = process.env.NODE_ENV !== "production";
if (isDev) {
  app.use(cors({ origin: "http://localhost:3000" }));
}

// ─── Serve React build on CF (approuter handles this in prod, but as fallback) ─
if (!isDev) {
  const buildPath = join(__dirname, "../build");
  app.use(express.static(buildPath));
}

// ══════════════════════════════════════════════════════════════════════════════
// CREDENTIAL RESOLUTION
// On CF: read from VCAP_SERVICES (Destination Service bound in mta.yaml)
// Locally: read from proxy/.env
// ══════════════════════════════════════════════════════════════════════════════
function getBtpConfig() {
  // ── Cloud Foundry: read from VCAP_SERVICES ────────────────────────────────
  if (process.env.VCAP_SERVICES) {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);

    // Find the destination service binding
    const destService =
      vcap["destination"]?.[0] ||
      vcap["destinations"]?.[0];

    if (!destService) {
      throw new Error("No Destination service found in VCAP_SERVICES. Check your mta.yaml bindings.");
    }

    const creds = destService.credentials;
    return {
      // These come from the Destination configured in BTP Cockpit
      // (named BTP_INTEGRATION_SUITE — see README)
      destinationServiceUrl: creds.uri,
      destinationServiceToken: creds.token,
      clientId: creds.clientid,
      clientSecret: creds.clientsecret,
      tokenUrl: creds.url,
    };
  }

  // ── Local development: read from proxy/.env ───────────────────────────────
  return {
    baseUrl: process.env.BTP_BASE_URL,
    tokenUrl: process.env.BTP_TOKEN_URL,
    clientId: process.env.BTP_CLIENT_ID,
    clientSecret: process.env.BTP_CLIENT_SECRET,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════
let tokenCache = { token: null, expiresAt: 0 };
let btpBaseUrl = null;

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt - 30_000) {
    return tokenCache.token;
  }

  const config = getBtpConfig();

  // On CF, first resolve the destination to get the actual BTP base URL + token
  if (process.env.VCAP_SERVICES) {
    const destToken = await fetchDestinationServiceToken(config);
    const dest = await fetchDestination(destToken, config.destinationServiceUrl);
    btpBaseUrl = dest.destinationConfiguration.URL;

    tokenCache = {
      token: dest.authTokens[0].value,
      expiresAt: now + (dest.authTokens[0].expiresIn * 1000),
    };
    return tokenCache.token;
  }

  // Local: standard OAuth2 client credentials
  btpBaseUrl = config.baseUrl;
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const res = await fetch(`${config.tokenUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) throw new Error(`Token fetch failed (${res.status}): ${await res.text()}`);

  const data = await res.json();
  tokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return tokenCache.token;
}

// ── Fetch a token for the Destination Service itself ─────────────────────────
async function fetchDestinationServiceToken(config) {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const res = await fetch(`${config.tokenUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json();
  return data.access_token;
}

// ── Fetch the destination config + auth token from Destination Service ────────
async function fetchDestination(destToken, destServiceUrl) {
  const res = await fetch(
    `${destServiceUrl}/destination-configuration/v1/destinations/BTP_INTEGRATION_SUITE`,
    { headers: { Authorization: `Bearer ${destToken}` } }
  );
  if (!res.ok) throw new Error(`Destination fetch failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// ── CSRF Token cache ──────────────────────────────────────────────────────────
let csrfCache = { token: null, cookie: null, expiresAt: 0 };

async function getCsrfToken(accessToken) {
  const now = Date.now();
  if (csrfCache.token && now < csrfCache.expiresAt - 30_000) return csrfCache;

  const res = await fetch(`${btpBaseUrl}/api/v1/`, {
    headers: { Authorization: `Bearer ${accessToken}`, "X-CSRF-Token": "Fetch" },
  });

  const csrf = res.headers.get("x-csrf-token");
  if (!csrf) throw new Error("CSRF token not returned by BTP.");

  csrfCache = {
    token: csrf,
    cookie: res.headers.get("set-cookie"),
    expiresAt: now + 30 * 60 * 1000,
  };
  return csrfCache;
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════
async function btpGet(path, res) {
  try {
    const token = await getAccessToken();
    const btpRes = await fetch(`${btpBaseUrl}/api/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const data = await btpRes.json();
    res.status(btpRes.status).json(data);
  } catch (err) {
    console.error("[btpGet]", err.message);
    res.status(500).json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/packages
app.get("/api/packages", (req, res) =>
  btpGet("IntegrationPackages?$format=json", res)
);

// GET /api/iflows?packageId=xxx
app.get("/api/iflows", (req, res) => {
  const { packageId } = req.query;
  const path = packageId
    ? `IntegrationPackages('${packageId}')/IntegrationDesigntimeArtifacts?$format=json`
    : `IntegrationDesigntimeArtifacts?$format=json`;
  return btpGet(path, res);
});

// GET /api/iflows/:id
app.get("/api/iflows/:id", (req, res) => {
  const version = req.query.version || "Active";
  btpGet(
    `IntegrationDesigntimeArtifacts(Id='${req.params.id}',Version='${version}')?$format=json`,
    res
  );
});

// POST /api/iflows — upload new iFlow zip
app.post("/api/iflows", upload.single("file"), async (req, res) => {
  try {
    const token = await getAccessToken();
    const csrf = await getCsrfToken(token);
    const { name, version, packageId } = req.body;

    const form = new FormData();
    form.append("Id", name.replace(/\s+/g, "_"));
    form.append("Name", name);
    form.append("PackageId", packageId);
    form.append("ArtifactContent", req.file.buffer, {
      filename: req.file.originalname,
      contentType: "application/zip",
    });

    const btpRes = await fetch(
      `${btpBaseUrl}/api/v1/IntegrationDesigntimeArtifacts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-CSRF-Token": csrf.token,
          ...(csrf.cookie ? { Cookie: csrf.cookie } : {}),
          ...form.getHeaders(),
        },
        body: form,
      }
    );
    res.status(btpRes.status).json(await btpRes.json());
  } catch (err) {
    console.error("[upload]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/iflows/:id
app.delete("/api/iflows/:id", async (req, res) => {
  try {
    const token = await getAccessToken();
    const csrf = await getCsrfToken(token);
    const version = req.query.version || "Active";

    const btpRes = await fetch(
      `${btpBaseUrl}/api/v1/IntegrationDesigntimeArtifacts(Id='${req.params.id}',Version='${version}')`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-CSRF-Token": csrf.token,
          ...(csrf.cookie ? { Cookie: csrf.cookie } : {}),
        },
      }
    );
    res.status(btpRes.status).json({ id: req.params.id });
  } catch (err) {
    console.error("[delete]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runtime
app.get("/api/runtime", (req, res) =>
  btpGet("IntegrationRuntimeArtifacts?$format=json", res)
);

// GET /api/runtime/:id
app.get("/api/runtime/:id", (req, res) =>
  btpGet(`IntegrationRuntimeArtifacts('${req.params.id}')?$format=json`, res)
);

// POST /api/iflows/:id/deploy
app.post("/api/iflows/:id/deploy", async (req, res) => {
  try {
    const token = await getAccessToken();
    const csrf = await getCsrfToken(token);
    const version = req.query.version || "Active";

    const btpRes = await fetch(
      `${btpBaseUrl}/api/v1/DeployIntegrationDesigntimeArtifact?Id='${req.params.id}'&Version='${version}'`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-CSRF-Token": csrf.token,
          ...(csrf.cookie ? { Cookie: csrf.cookie } : {}),
        },
      }
    );
    const text = await btpRes.text();
    res.status(btpRes.status).json({ message: text || "Deploy triggered" });
  } catch (err) {
    console.error("[deploy]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  const env = process.env.VCAP_SERVICES ? "Cloud Foundry" : "local";
  console.log(`✅ BTP proxy running on port ${PORT} [${env}]`);
});
