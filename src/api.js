// ─────────────────────────────────────────────────────────────────────────────
// BTP Integration Suite — Real API client
//
// All calls go to the local proxy (http://localhost:3001).
// The proxy handles OAuth tokens and CSRF tokens transparently.
// ─────────────────────────────────────────────────────────────────────────────

// Relative path works locally (proxied by React dev server) and on CF (routed by Approuter)
const PROXY = "";

async function handleResponse(res) {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.error?.message?.value || body?.error || message;
    } catch {
      message = await res.text() || message;
    }
    throw new Error(message);
  }
  // 204 No Content (e.g. delete success) has no body
  if (res.status === 204) return {};
  return res.json();
}

// ── GET /IntegrationPackages ──────────────────────────────────────────────────
export async function fetchPackages() {
  const res = await fetch(`${PROXY}/api/packages`);
  const data = await handleResponse(res);
  // BTP OData wraps results in d.results
  return (data?.d?.results || []).map((p) => ({
    id: p.Id,
    name: p.Name,
  }));
}

// ── GET /IntegrationDesigntimeArtifacts (by package) ─────────────────────────
export async function fetchIFlows(packageId) {
  const url = packageId
    ? `${PROXY}/api/iflows?packageId=${encodeURIComponent(packageId)}`
    : `${PROXY}/api/iflows`;
  const res = await fetch(url);
  const data = await handleResponse(res);
  return (data?.d?.results || []).map(mapIFlow);
}

// ── GET /IntegrationRuntimeArtifacts (merge runtime status into list) ─────────
export async function fetchIFlowsWithStatus(packageId) {
  const [iflows, runtime] = await Promise.all([
    fetchIFlows(packageId),
    fetchRuntimeArtifacts(),
  ]);

  const statusMap = Object.fromEntries(
    runtime.map((r) => [r.id, { status: r.status, deployedBy: r.deployedBy }])
  );

  return iflows.map((f) => ({
    ...f,
    status: statusMap[f.id]?.status?.toLowerCase() || "not deployed",
    deployedBy: statusMap[f.id]?.deployedBy || "-",
  }));
}

// ── GET /IntegrationRuntimeArtifacts ─────────────────────────────────────────
export async function fetchRuntimeArtifacts() {
  const res = await fetch(`${PROXY}/api/runtime`);
  const data = await handleResponse(res);
  return (data?.d?.results || []).map((r) => ({
    id: r.Id,
    name: r.Name,
    status: r.Status,
    version: r.Version,
    deployedBy: r.DeployedBy,
    deployedOn: r.DeployedOn,
    errorInfo: r.ErrorInformation,
  }));
}

// ── POST /DeployIntegrationDesigntimeArtifact ─────────────────────────────────
export async function deployIFlow(id, version = "Active") {
  const res = await fetch(
    `${PROXY}/api/iflows/${encodeURIComponent(id)}/deploy?version=${encodeURIComponent(version)}`,
    { method: "POST" }
  );
  return handleResponse(res);
}

// ── POST /IntegrationDesigntimeArtifacts (upload zip) ────────────────────────
export async function uploadIFlow({ name, version, packageId, file }) {
  const form = new FormData();
  form.append("name", name);
  form.append("version", version);
  form.append("packageId", packageId);
  form.append("file", file, file.name);

  const res = await fetch(`${PROXY}/api/iflows`, {
    method: "POST",
    body: form,
  });
  const data = await handleResponse(res);
  return mapIFlow(data?.d || data);
}

// ── DELETE /IntegrationDesigntimeArtifacts ────────────────────────────────────
export async function deleteIFlow(id, version = "Active") {
  const res = await fetch(
    `${PROXY}/api/iflows/${encodeURIComponent(id)}?version=${encodeURIComponent(version)}`,
    { method: "DELETE" }
  );
  return handleResponse(res);
}

// ─── Internal mapper ──────────────────────────────────────────────────────────
function mapIFlow(raw) {
  return {
    id: raw.Id,
    name: raw.Name,
    packageId: raw.PackageId,
    packageName: raw.PackageId, // BTP doesn't return package name inline; we resolve it separately if needed
    version: raw.Version,
    status: "not deployed", // Runtime status comes from IntegrationRuntimeArtifacts
    deployedBy: "-",
  };
}
