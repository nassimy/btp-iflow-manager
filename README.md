# BTP iFlow Manager

A React application for managing Integration Flows (iFlows) on SAP Business Technology Platform Integration Suite.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
src/
├── mock/
│   └── api.js              ← All mock API calls — replace with real BTP OData calls here
├── components/
│   ├── UI.jsx              ← Shared primitives: Button, Badge, Spinner, FormRow
│   ├── Modal.jsx           ← Base modal shell
│   ├── Toast.jsx           ← Toast notification system
│   ├── IFlowTable.jsx      ← Main iFlow list table
│   ├── UploadModal.jsx     ← Upload .zip iFlow modal
│   └── ConfirmModal.jsx    ← Deploy / Delete confirmation modals
└── App.jsx                 ← Root component — state, routing between views
```

---

## Connecting to the Real BTP API

All API calls live in `src/mock/api.js`. Replace each function with a real `fetch()` to your tenant.

### Authentication

BTP Integration Suite uses **OAuth 2.0 (Client Credentials)**. You'll need:
- Tenant URL (e.g. `https://<tenant>.it-cpi018-rt.cfapps.eu10.hana.ondemand.com`)
- Client ID & Secret from your BTP subaccount service key

### Real endpoint mapping

| Mock function    | Real BTP OData endpoint                                              |
|------------------|----------------------------------------------------------------------|
| `fetchIFlows`    | `GET /api/v1/IntegrationDesigntimeArtifacts`                        |
| `fetchPackages`  | `GET /api/v1/IntegrationPackages`                                   |
| `uploadIFlow`    | `POST /api/v1/IntegrationDesigntimeArtifacts`                       |
| `deployIFlow`    | `POST /api/v1/DeployIntegrationDesigntimeArtifact?Id='...'&Version='...'` |
| `deleteIFlow`    | `DELETE /api/v1/IntegrationDesigntimeArtifacts(Id='...',Version='...')` |

---

## Features

- **Environment tabs** — switch between Development, QA / Testing, and Production
- **Stats bar** — total, running, error, and not-deployed counts per environment
- **Filterable table** — search by name/ID, filter by package and status
- **Upload iFlow** — drag-and-drop or pick a `.zip` file with name, version, and package
- **Deploy** — one-click deploy with confirmation dialog
- **Delete** — delete with confirmation guard

## Next Steps

- [ ] Connect real BTP OData APIs in `src/mock/api.js`
- [ ] Add OAuth token fetch + refresh logic
- [ ] iFlow detail drawer (logs, run status, configuration)
- [ ] Version history per iFlow
- [ ] Role-based access (read-only in Production for non-admins)
# btp-iflow-manager
