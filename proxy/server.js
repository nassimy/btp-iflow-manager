import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
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
// FIX 1: reduced TTL from 30 min → 5 min (SAP CPI tokens expire ~10 min)
let csrfCache = { token: null, cookie: null, expiresAt: 0 };

function invalidateCsrfCache() {
  csrfCache = { token: null, cookie: null, expiresAt: 0 };
}

async function getCsrfToken() {
  const now = Date.now();
  if (csrfCache.token && now < csrfCache.expiresAt - 30_000) return csrfCache;

  const { token, baseUrl } = await getBtpToken();

  // FIX 2: removed trailing slash from /api/v1/ → /api/v1
  const res = await fetch(`${baseUrl}/api/v1`, {
    headers: { Authorization: `Bearer ${token}`, "X-CSRF-Token": "Fetch" },
  });

  const csrf = res.headers.get("x-csrf-token");
  if (!csrf) throw new Error(`No CSRF token returned (status ${res.status})`);

  // FIX 3: cache for 5 min instead of 30 min
  csrfCache = { token: csrf, cookie: res.headers.get("set-cookie"), expiresAt: now + 5 * 60 * 1000 };
  console.log("CSRF token refreshed");
  return csrfCache;
}

// ── CSRF-aware POST/DELETE helper with auto-retry on 403 ─────────────────────
// FIX 4: single retry with fresh CSRF token when BTP returns 403
async function btpWrite(buildRequest) {
  const { token, baseUrl } = await getBtpToken();
  let csrf = await getCsrfToken();

  let btpRes = await buildRequest(token, baseUrl, csrf);

  if (btpRes.status === 403) {
    console.warn("[btpWrite] 403 received — refreshing CSRF token and retrying...");
    invalidateCsrfCache();
    csrf = await getCsrfToken();
    btpRes = await buildRequest(token, baseUrl, csrf);
  }

  return btpRes;
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
  const id = encodeURIComponent(req.params.id);
  btpGet(`IntegrationDesigntimeArtifacts(Id=%27${id}%27,Version=%27${version}%27)?$format=json`, res);
});

app.get("/api/iflows/:id/configurations", (req, res) => {
  const version = req.query.version || "Active";
  const id = encodeURIComponent(req.params.id);
  btpGet(`IntegrationDesigntimeArtifacts(Id=%27${id}%27,Version=%27${version}%27)/Configurations?$format=json`, res);
});

app.get("/api/runtime", (req, res) =>
  btpGet("IntegrationRuntimeArtifacts?$format=json", res)
);

app.get("/api/runtime/:id", (req, res) =>
  btpGet(`IntegrationRuntimeArtifacts('${req.params.id}')?$format=json`, res)
);

// FIX 5: deploy URL uses %27 encoding instead of raw single quotes
app.post("/api/iflows/:id/deploy", async (req, res) => {
  try {
    const version = req.query.version || "Active";

    const btpRes = await btpWrite((token, baseUrl, csrf) =>
      fetch(
        `${baseUrl}/api/v1/DeployIntegrationDesigntimeArtifact?Id=%27${encodeURIComponent(req.params.id)}%27&Version=%27${encodeURIComponent(version)}%27`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-CSRF-Token": csrf.token,
            ...(csrf.cookie ? { Cookie: csrf.cookie } : {}),
          },
        }
      )
    );

    console.log("[deploy] status:", btpRes.status);
    const text = await btpRes.text();
    console.log("[deploy] response:", text.substring(0, 300));
    res.status(btpRes.status).json({ message: text || "Deploy triggered" });
  } catch (err) {
    console.error("[deploy]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Undeploy iFlow from runtime
app.delete("/api/iflows/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const btpRes = await btpWrite((token, baseUrl, csrf) =>
      fetch(`${baseUrl}/api/v1/IntegrationRuntimeArtifacts('${id}')`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-CSRF-Token": csrf.token,
          ...(csrf.cookie ? { Cookie: csrf.cookie } : {}),
        },
      })
    );

    console.log("[undeploy] status:", btpRes.status);
    const text = await btpRes.text();
    console.log("[undeploy] response:", text.substring(0, 300));

    // 202 = undeploy accepted (async), 404 = already undeployed (treat as success)
    if (btpRes.status === 202 || btpRes.status === 404) {
      return res.status(200).json({ id, message: btpRes.status === 404 ? "Already undeployed" : "Undeploy triggered" });
    }

    res.status(btpRes.status).json({ id, message: text || "Unexpected response" });
  } catch (err) {
    console.error("[undeploy]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Proxy running on port ${PORT} [${process.env.VCAP_SERVICES ? "CF" : "local"}]`);
});