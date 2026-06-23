// ─────────────────────────────────────────────
// Mock BTP Integration Suite API
// Replace each function with a real fetch() call
// to your tenant's OData endpoint when ready.
// ─────────────────────────────────────────────

const delay = (ms = 400) => new Promise(r => setTimeout(r, ms));

const MOCK_IFLOWS = [
  { id: "IF-001", name: "CreateSalesOrder",    packageId: "pkg-om",  packageName: "Order Management",    version: "1.4.2", status: "started",      deployedBy: "a.müller",   env: "Development" },
  { id: "IF-002", name: "SyncInventory",        packageId: "pkg-om",  packageName: "Order Management",    version: "2.0.1", status: "error",         deployedBy: "s.chen",     env: "Development" },
  { id: "IF-003", name: "GenerateInvoice",      packageId: "pkg-fin", packageName: "Finance & Reporting", version: "1.1.0", status: "started",      deployedBy: "p.dupont",   env: "Development" },
  { id: "IF-004", name: "PostToLedger",         packageId: "pkg-fin", packageName: "Finance & Reporting", version: "3.2.0", status: "stopped",       deployedBy: "p.dupont",   env: "Development" },
  { id: "IF-005", name: "EmployeeOnboarding",   packageId: "pkg-hr",  packageName: "HR Integration",      version: "1.0.5", status: "started",      deployedBy: "r.singh",    env: "Development" },
  { id: "IF-006", name: "FetchCustomerData",    packageId: "pkg-cp",  packageName: "Customer Portal",     version: "2.3.1", status: "not deployed", deployedBy: "-",          env: "Development" },
  { id: "IF-007", name: "LegacySAPConnector",   packageId: "pkg-lb",  packageName: "Legacy Bridge",       version: "0.9.8", status: "started",      deployedBy: "j.oliveira", env: "QA / Testing" },
  { id: "IF-008", name: "ReplicationFlow",      packageId: "pkg-om",  packageName: "Order Management",    version: "1.2.0", status: "stopped",       deployedBy: "a.müller",   env: "QA / Testing" },
  { id: "IF-009", name: "ComplianceReport",     packageId: "pkg-fin", packageName: "Finance & Reporting", version: "4.0.0", status: "started",      deployedBy: "p.dupont",   env: "Production" },
  { id: "IF-010", name: "CustomerPortalSync",   packageId: "pkg-cp",  packageName: "Customer Portal",     version: "2.1.0", status: "started",      deployedBy: "s.chen",     env: "Production" },
];

const MOCK_PACKAGES = [
  { id: "pkg-om",  name: "Order Management" },
  { id: "pkg-fin", name: "Finance & Reporting" },
  { id: "pkg-hr",  name: "HR Integration" },
  { id: "pkg-cp",  name: "Customer Portal" },
  { id: "pkg-lb",  name: "Legacy Bridge" },
];

// In-memory store (simulates backend state)
let iflows = [...MOCK_IFLOWS];
let nextId = iflows.length + 1;

// ── GET /IntegrationDesigntimeArtifacts ──────
export async function fetchIFlows(env) {
  await delay();
  return iflows.filter(f => f.env === env);
}

// ── GET /IntegrationPackages ─────────────────
export async function fetchPackages() {
  await delay(200);
  return [...MOCK_PACKAGES];
}

// ── POST /IntegrationDesigntimeArtifacts ─────
export async function uploadIFlow({ name, version, packageId, packageName, env, file }) {
  await delay(800);
  if (!name || !version || !packageId || !file) throw new Error("Missing required fields.");
  const id = `IF-${String(100 + nextId++).padStart(3, "0")}`;
  const newFlow = { id, name, packageId, packageName, version, status: "not deployed", deployedBy: "-", env };
  iflows.push(newFlow);
  return newFlow;
}

// ── POST /DeployIntegrationDesigntimeArtifact ─
export async function deployIFlow(id) {
  await delay(900);
  const flow = iflows.find(f => f.id === id);
  if (!flow) throw new Error(`iFlow ${id} not found.`);
  flow.status = "started";
  flow.deployedBy = "you";
  return { ...flow };
}

// ── DELETE /IntegrationDesigntimeArtifacts ───
export async function deleteIFlow(id) {
  await delay(500);
  const idx = iflows.findIndex(f => f.id === id);
  if (idx === -1) throw new Error(`iFlow ${id} not found.`);
  iflows.splice(idx, 1);
  return { id };
}
