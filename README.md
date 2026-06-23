# BTP iFlow Manager — v2

React + Node.js application for managing Integration Flows on SAP BTP Integration Suite.
Deployable to Cloud Foundry via BAS or CF CLI.

---

## Project Structure

```
btp-iflow-manager-v2/
├── src/                        ← React frontend
│   ├── api.js                  ← All API calls to the proxy
│   ├── App.jsx                 ← Root component
│   └── components/             ← UI components
├── proxy/                      ← Node.js backend (talks to BTP)
│   ├── server.js               ← Express server + BTP API proxy
│   ├── package.json
│   └── .env.example            ← Copy to .env for local development
├── approuter/                  ← SAP Approuter (CF auth + routing)
│   ├── package.json
│   └── xs-app.json             ← Route definitions
├── public/
│   └── index.html
├── mta.yaml                    ← MTA deployment descriptor for CF
├── xs-security.json            ← XSUAA roles and scopes
├── package.json                ← React scripts + dev shortcuts
└── .gitignore
```

---

## Local Development

### 1. Set up credentials

```bash
cp proxy/.env.example proxy/.env
```

Edit `proxy/.env` with your BTP service key values:

```
BTP_BASE_URL=https://<your-tenant>.it-cpi018-rt.cfapps.eu10.hana.ondemand.com
BTP_TOKEN_URL=https://<your-tenant>.authentication.eu10.hana.ondemand.com
BTP_CLIENT_ID=sb-xxxxxxxx!xxxxxxx
BTP_CLIENT_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> **Where to find these values:**
> BTP Cockpit → Subaccount → Services → Instances
> → Open your "Process Integration Runtime" instance (plan: api)
> → Service Keys → View your key JSON

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

React automatically proxies `/api/*` requests to the proxy (configured in `package.json` via `"proxy": "http://localhost:3001"`).

---

## Deploy to Cloud Foundry (via BAS)

### 1. Create a Destination in BTP Cockpit

Go to: **BTP Cockpit → Subaccount → Connectivity → Destinations → New Destination**

| Field              | Value                                                                 |
|--------------------|-----------------------------------------------------------------------|
| Name               | `BTP_INTEGRATION_SUITE`                                               |
| Type               | HTTP                                                                  |
| URL                | `https://<your-tenant>.it-cpi018-rt.cfapps.eu10.hana.ondemand.com`  |
| Authentication     | OAuth2ClientCredentials                                               |
| Client ID          | `sb-xxxxxxxx` (from service key)                                      |
| Client Secret      | `xxxxxxxx` (from service key)                                         |
| Token Service URL  | `https://<tenant>.authentication.eu10.hana.ondemand.com/oauth/token` |

### 2. Open project in BAS

```bash
cd /home/user/projects
git clone https://github.com/yourname/btp-iflow-manager.git
cd btp-iflow-manager
npm install
cd proxy && npm install && cd ..
```

### 3. Connect to Cloud Foundry in BAS

- Press `Ctrl+Shift+P` → **CF: Login to Cloud Foundry**
- Enter your API endpoint: `https://api.cf.eu10.hana.ondemand.com`
- Select your org and space

### 4. Build and deploy

```bash
# Build the MTA archive
mbt build

# Deploy to CF
cf deploy mta_archives/btp-iflow-manager_1.0.0.mtar
```

Or in BAS: right-click `mta.yaml` → **Build MTA** → then **Deploy MTA Archive**.

CF will automatically:
- Build the React app (`npm run build`)
- Deploy the Node proxy as a CF app
- Deploy the Approuter
- Create and bind XSUAA and Destination service instances
- Wire everything together

### 5. Access the app

After deploy, CF prints the Approuter URL:
```
https://btp-iflow-manager-approuter.cfapps.eu10.hana.ondemand.com
```

---

## How credentials work on CF

```
proxy/.env          ← LOCAL ONLY  (gitignored, never committed)
VCAP_SERVICES       ← CF ONLY     (injected automatically by CF at runtime)
```

On CF, the proxy reads credentials from `VCAP_SERVICES` (the Destination Service binding).
No credentials are ever hardcoded or stored in the repository.

---

## Roles

Defined in `xs-security.json` and assigned in BTP Cockpit → Security → Role Collections:

| Role          | Permissions                        |
|---------------|------------------------------------|
| Viewer        | View iFlows and status             |
| Operator      | View + Deploy                      |
| Administrator | View + Deploy + Upload + Delete    |
