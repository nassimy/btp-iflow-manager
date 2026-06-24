import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import FormData from "form-data";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const isDev = process.env.NODE_ENV !== "production";

if (isDev) app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

// ── Read Destination Service credentials from VCAP_SERVICES ──────────────────
function getDestinationServiceCreds() {
  if (process.env.VCAP_SERVICES) {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const dest = vcap["destination"]?.[0];
    if (!dest) throw new Error("No destination service in VCAP_SERVICES");
    return dest.credentials;
  }
  // Local fallback
  return {
    clientid: process.env.BTP_CLIENT_ID,
    clientsecret: process.env.BTP_CLIENT_SECRET,
    url: process.env.BTP_TOKEN_URL,
    uri: process.env.BTP_DESTINATION_URI || "https://destination-configuration.cfapps.us10.hana.ondemand.com",
  };
}

// ── Step 1: Get token for the Destination Service itself ──────────────────────
let destServiceTokenCache = { token: null, expiresAt: 0 };

async function getDestinationServiceToken() {
  const now = Date.now();
  if (destServiceTokenCache.token && now < destServiceTokenCache.expiresAt - 30_000) {
    return destServiceTokenCache.token;
  }

  const creds = getDestinationServiceCreds();
  console.log("Fetching Destination Service token from:", creds.url);

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientid,
    client_secret: creds.clientsecret,
  });

  const res = await fetch(`${creds.url}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) throw new Error(`Destination Service token failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  destServiceTokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return destServiceTokenCache.token;
}

// ── Step 2: Resolve the named destination → get BTP base URL + BTP token ─────
let btpTokenCache = { token: null, expiresAt: 0, baseUrl: null };

async function getBtpToken() {
  const now = Date.now();
  if (btpTokenCache.token && now < btpTokenCache.expiresAt - 30_000) {
    return { token: btpTokenCache.token, baseUrl: btpTokenCache.baseUrl };
  }

  const creds = getDestinationServiceCreds();
  const destServiceToken = await getDestinationServiceToken();

  const destUrl = `${creds.uri}/destination-configuration/v1/destinations/BTP_INTEGRATION_SUITE`;
  console.log("Resolving destination from:", destUrl);

  const res = await fetch(destUrl, {
    headers: { Authorization: `Bearer ${destServiceToken}` },
  });

  if (!res.ok) throw new Error(`Destination resolution failed (${res.status}): ${await res.text()}`);

  const data = await res.json();
  console.log("Destination resolved:", data.destinationConfiguration?.URL);

  const authToken = data.authTokens?.[0];
  if (!authToken || authToken.error) {
    throw new Error(`No auth token in destination response: ${JSON.stringify(authToken)}`);
  }

  btpTokenCache = {
    token: authToken.value,
    expiresAt: now + (parseInt(authToken.expiresIn) || 3600) * 1000,
    baseUrl: data.destinationConfiguration.URL,
  };

  return { token: btpTokenCache.token, baseUrl: btpTokenCache.baseUrl };
}

// ── CSRF cache ────────────────────────────────────────────────────────────────
let csrfCache = { token: null, cookie: null, expiresAt: 0 };

async function getCsrfToken() {
  const now = Date.now();
  if (csrfCache.token && now < csrfCache.expiresAt - 30_000) return csrfCache;

  const { token, baseUrl } = await getBtpToken();
  const res = await fetch(`${baseUrl}/api/v1/`, {
    headers: { Authorization: `Bearer ${token}`, "X-CSRF-Token": "Fetch" },
  });
  const csrf = res.headers.get("x-csrf-token");
  if (!csrf) throw new Error("No CSRF token returned");
  csrfCache = { token: csrf, cookie: res.headers.get("set-cookie"), expiresAt: now + 30 * 60 * 1000 };
  return csrfCache;
}

// ── Safe JSON parse ───────────────────────────────────────────────────────────
async function safeJson(btpRes) {
  const text = await btpRes.text();
  if (!text || text.trim() === "") return { d: { results: [] } };
  try { return JSON.parse(text); }
  catch { console.error("Failed to parse response:", text.substring(0, 200)); return { d: { results: [] } }; }
}

// ── GET helper ────────────────────────────────────────────────────────────────
async function btpGet(path, res) {
  try {
    const { token, baseUrl } = await getBtpToken();
    const url = `${baseUrl}/api/v1/${path}`;
    console.log("GET", url);
    const btpRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const data = await safeJson(btpRes);
    res.status(btpRes.status).json(data);
  } catch (err) {
    console.error("[btpGet]", err.message);
    res.status(500).json({ error: err.message });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/packages", (req, res) =>
  btpGet("IntegrationPackages?$format=json&$orderby=Name", res)
);

app.get("/api/iflows", (req, res) => {
  const { packageId } = req.query;
  if (!packageId) return res.status(400).json({ error: "packageId is required" });
  return btpGet(`IntegrationPackages('${packageId}')/IntegrationDesigntimeArtifacts?$format=json`, res);
});

app.get("/api/iflows/:id", (req, res) => {
  const version = req.query.version || "Active";
  btpGet(`IntegrationDesigntimeArtifacts(Id='${req.params.id}',Version='${version}')?$format=json`, res);
});

app.get("/api/runtime", (req, res) =>
  btpGet("IntegrationRuntimeArtifacts?$format=json", res)
);

app.get("/api/runtime/:id", (req, res) =>
  btpGet(`IntegrationRuntimeArtifacts('${req.params.id}')?$format=json`, res)
);

app.post("/api/iflows/:id/deploy", async (req, res) => {
  try {
    const { token, baseUrl } = await getBtpToken();
    const csrf = await getCsrfToken();
    const version = req.query.version || "Active";
    const btpRes = await fetch(
      `${baseUrl}/api/v1/DeployIntegrationDesigntimeArtifact?Id='${req.params.id}'&Version='${version}'`,
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

app.post("/api/iflows", upload.single("file"), async (req, res) => {
  try {
    const { token, baseUrl } = await getBtpToken();
    const csrf = await getCsrfToken();
    const { name, version, packageId } = req.body;
    const form = new FormData();
    form.append("Id", name.replace(/\s+/g, "_"));
    form.append("Name", name);
    form.append("PackageId", packageId);
    form.append("ArtifactContent", req.file.buffer, {
      filename: req.file.originalname,
      contentType: "application/zip",
    });
    const btpRes = await fetch(`${baseUrl}/api/v1/IntegrationDesigntimeArtifacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-CSRF-Token": csrf.token,
        ...(csrf.cookie ? { Cookie: csrf.cookie } : {}),
        ...form.getHeaders(),
      },
      body: form,
    });
    res.status(btpRes.status).json(await safeJson(btpRes));
  } catch (err) {
    console.error("[upload]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/iflows/:id", async (req, res) => {
  try {
    const { token, baseUrl } = await getBtpToken();
    const csrf = await getCsrfToken();
    const version = req.query.version || "Active";
    const btpRes = await fetch(
      `${baseUrl}/api/v1/IntegrationDesigntimeArtifacts(Id='${req.params.id}',Version='${version}')`,
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

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Proxy running on port ${PORT} [${process.env.VCAP_SERVICES ? "CF" : "local"}]`);
});
