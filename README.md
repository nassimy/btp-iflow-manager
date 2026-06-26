# BTP iFlow Manager — v2

React + Node.js application for managing Integration Flows on SAP BTP Integration Suite.
Deployable to Cloud Foundry via MTA — fully self-contained.

---

## Features

- 📦 **Package browser** — browse all integration packages, click to drill into iFlows
- ⚡ **Deploy / Redeploy / Undeploy** — single-click actions per iFlow with confirmation
- 🔁 **Bulk actions** — select multiple iFlows and deploy or undeploy in one go
- 🔍 **Detail panel** — view iFlow configuration parameters, runtime info, deployed on/by, and version mismatch warnings
- 🔧 **Maintenance mode** — undeploy groups of iFlows for maintenance and restore them all at once
- 👥 **Maintenance groups** — define named groups (Finance, Sales, etc.) for recurring maintenance
- 📊 **Live stat cards** — Total / Running / Errors / Not deployed, updated per package filter
- 🔃 **Auto-refresh** — configurable interval (30s / 60s / 2m / 5m) with live countdown
- 🔀 **Sortable columns** — click any column header to sort ascending/descending
- 📄 **Pagination** — 10 / 25 / 50 / 100 iFlows per page

---

## Project Structure

```
btp-iflow-manager/
├── src/                          ← React frontend
│   ├── api.js                    ← All API calls to the proxy
│   ├── App.jsx                   ← Root component + navigation
│   └── components/
│       ├── PackagesView.jsx      ← Package cards grid
│       ├── IFlowTable.jsx        ← iFlow table with pagination + sort
│       ├── IFlowDetailPanel.jsx  ← Detail popup (config, runtime, version mismatch)
│       ├── ConfirmModal.jsx      ← Deploy / Redeploy / Undeploy / Bulk modals
│       ├── MaintenanceTab.jsx    ← Maintenance mode + groups
│       ├── UI.jsx                ← Shared UI components (Button, Badge, Spinner…)
│       ├── Modal.jsx             ← Base modal
│       └── Toast.jsx             ← Toast notifications
├── proxy/                        ← Node.js backend (BTP API proxy)
│   ├── server.js                 ← Express server
│   ├── package.json
│   └── .env.example              ← Copy to .env for local dev
├── approuter/                    ← SAP Approuter (auth + routing)
│   ├── xs-app.json               ← Route definitions
│   ├── package.json
│   └── resources/                ← React build output (generated)
├── public/
│   └── index.html
├── mta.yaml                      ← MTA deployment descriptor
├── xs-security.json              ← XSUAA roles and scopes
├── build-ui.sh                   ← Build script used by MTA
├── setup.sh                      ← Post-deploy setup script (run once)
├── package.json
├── .gitignore
└── .mtaignore
```

---

## Local Development

### 1. Set up credentials

```bash
cp proxy/.env.example proxy/.env
```

Edit `proxy/.env` with your BTP service key values:

```env
BTP_CLIENT_ID=sb-xxxxxxxx!xxxxxxx
BTP_CLIENT_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
BTP_TOKEN_URL=https://<tenant>.authentication.<region>.hana.ondemand.com
BTP_DESTINATION_URI=https://destination-configuration.cfapps.<region>.hana.ondemand.com
```

> **Where to find these values:**
> BTP Cockpit → Subaccount → Instances → your `it-rt` instance (plan: api)
> → Service Keys → view the key JSON

### 2. Install dependencies

```bash
# Root (React)
npm install

# Proxy (Node.js backend)
cd proxy && npm install && cd ..
```

### 3. Start both servers

```bash
npm run dev
```

This starts:
- React on `http://localhost:3000`
- Proxy on `http://localhost:3001`

React automatically proxies `/api/*` requests to the proxy via `"proxy": "http://localhost:3001"` in `package.json`.

---

## Deploy to Cloud Foundry

### Prerequisites

- BAS or CF CLI installed and logged in
- MBT (MTA Build Tool) installed: `npm install -g mbt`
- An existing `it-rt` service instance (plan: `api`) in your CF space
- CF target set to correct org/space: `cf target -o <org> -s <space>`

### Step 1 — Update setup.sh

Open `setup.sh` and set the two config values at the top:

```bash
INTEGRATION_SUITE_URL="https://<your-tenant>.integrationsuite.cfapps.<region>.hana.ondemand.com"
IT_RT_INSTANCE="<your-it-rt-instance-name>"   # e.g. is-api-instance
```

### Step 2 — Build and deploy MTA

```bash
mbt build
cf deploy mta_archives/btp-iflow-manager_1.0.0.mtar
```

This will automatically:
- Build the React app
- Deploy the Node.js proxy (`btp-iflow-manager-srv`)
- Deploy the Approuter (`btp-iflow-manager-approuter`)
- Create and bind XSUAA service instance
- Create and bind Destination service instance

### Step 3 — Run setup script (once per environment)

```bash
chmod +x setup.sh
./setup.sh
```

This script:
1. Creates a service key for your `it-rt` instance → reads `clientId`, `clientSecret`, `tokenUrl`
2. Creates a service key for the Destination service → gets an OAuth token
3. Creates the `BTP_INTEGRATION_SUITE` destination via the Destination Service REST API
4. Restages both apps to pick up the new bindings
5. Cleans up all temporary service keys

> Run `setup.sh` again whenever you redeploy to a new BTP account or the destination credentials change.

### Step 4 — Assign roles

In BTP Cockpit → Security → Role Collections, create a role collection and assign the relevant roles:

| Role | Permissions |
|------|-------------|
| Viewer | View iFlows and status |
| Operator | View + Deploy + Redeploy + Undeploy |
| Administrator | Full access |

Then assign the role collection to your user under **Security → Users**.

### Step 5 — Access the app

After deploy, CF prints the Approuter URL:
```
https://<subaccount>-<space>-btp-iflow-manager-approuter.cfapps.<region>.hana.ondemand.com
```

---

## How credentials work

```
proxy/.env       ← LOCAL ONLY  (gitignored, never committed)
VCAP_SERVICES    ← CF ONLY     (injected automatically by CF at runtime)
```

On CF, the proxy reads the Destination Service credentials from `VCAP_SERVICES` and uses them to resolve the `BTP_INTEGRATION_SUITE` destination — which contains the OAuth credentials for the Integration Suite API. No credentials are ever hardcoded or stored in the repository.

---

## Redeploying to a new BTP account

1. `cf login` to the new account
2. Update `INTEGRATION_SUITE_URL` and `IT_RT_INSTANCE` in `setup.sh`
3. Update redirect URIs in `xs-security.json` if needed
4. Run:
   ```bash
   mbt build
   cf deploy mta_archives/btp-iflow-manager_1.0.0.mtar
   ./setup.sh
   ```

---

## Architecture

```
Browser
  │
  ▼
Approuter (CF)          ← handles XSUAA authentication + routing
  │   /api/* → srv-api destination (with JWT forwarding)
  │   /*     → static React files from resources/
  │
  ▼
Node.js Proxy (CF)      ← btp-iflow-manager-srv
  │   reads VCAP_SERVICES → Destination Service
  │   resolves BTP_INTEGRATION_SUITE destination
  │   fetches token via OAuth2ClientCredentials
  │
  ▼
SAP Integration Suite API
  └── /api/v1/IntegrationPackages
  └── /api/v1/IntegrationDesigntimeArtifacts
  └── /api/v1/IntegrationRuntimeArtifacts
  └── /api/v1/DeployIntegrationDesigntimeArtifact
```

---

## Maintenance Groups

Maintenance groups let you define named sets of iFlows (e.g. "Finance", "Sales") that can be undeployed and restored together. Groups are stored in `localStorage` per browser — when you're ready to persist them server-side, only the read/write functions in `MaintenanceTab.jsx` need to change.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `403 Forbidden` on deploy/undeploy | CSRF token stale or missing role | The proxy auto-retries with a fresh CSRF token. If persists, check `AuthGroup_IntegrationDeveloper` role in Integration Suite |
| `406 Not Acceptable` | Wrong content type sent to BTP API | Already fixed — proxy sends `application/json` |
| `501 Not Implemented` | iFlow ID has special chars in URL | Already fixed — proxy uses `%27` encoding |
| Blank page after deploy | Browser cache | Hard refresh: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows) |
| Auto-refresh not visible | Old build cached | Rebuild: `mbt build && cf deploy ...` then hard refresh |