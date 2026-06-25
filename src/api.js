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
  if (res.status === 204) return {};
  return res.json();
}

// ── GET /IntegrationPackages ──────────────────────────────────────────────────
export async function fetchPackages() {
  const res = await fetch(`${PROXY}/api/packages`);
  const data = await handleResponse(res);
  return (data?.d?.results || []).map((p) => ({
    id: p.Id,
    name: p.Name,
  }));
}

// ── GET iFlows per package ────────────────────────────────────────────────────
export async function fetchIFlows(packages) {
  if (!packages || packages.length === 0) return [];
  const results = await Promise.all(
    packages.map(async (pkg) => {
      const res = await fetch(
        `${PROXY}/api/iflows?packageId=${encodeURIComponent(pkg.id)}`
      );
      const data = await handleResponse(res);
      return (data?.d?.results || []).map((f) => mapIFlow(f, pkg.name));
    })
  );
  return results.flat();
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

// ── GET single iFlow detail ───────────────────────────────────────────────────
export async function fetchIFlowDetail(id) {
  const res = await fetch(`${PROXY}/api/iflows/${encodeURIComponent(id)}`);
  const data = await handleResponse(res);
  return data?.d || null;
}

// ── GET iFlow configuration parameters ───────────────────────────────────────
export async function fetchIFlowConfigurations(id) {
  const res = await fetch(`${PROXY}/api/iflows/${encodeURIComponent(id)}/configurations`);
  const data = await handleResponse(res);
  return (data?.d?.results || []).map((c) => ({
    key:          c.ParameterKey,
    value:        c.ParameterValue,
    type:         c.DataType,
  }));
}

// ── GET runtime detail for single iFlow ──────────────────────────────────────
export async function fetchRuntimeDetail(id) {
  const res = await fetch(`${PROXY}/api/runtime/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  const data = await handleResponse(res);
  const r = data?.d || null;
  if (!r) return null;
  return {
    id:          r.Id,
    status:      r.Status,
    version:     r.Version,
    deployedBy:  r.DeployedBy,
    deployedOn:  r.DeployedOn,
    errorInfo:   r.ErrorInformation?.Parameter || null,
  };
}

// ── POST /DeployIntegrationDesigntimeArtifact ─────────────────────────────────
export async function deployIFlow(id, version = "Active") {
  const res = await fetch(
    `${PROXY}/api/iflows/${encodeURIComponent(id)}/deploy?version=${encodeURIComponent(version)}`,
    { method: "POST" }
  );
  return handleResponse(res);
}

// ── DELETE /IntegrationRuntimeArtifacts (undeploy) ───────────────────────────
export async function deleteIFlow(id) {
  const res = await fetch(
    `${PROXY}/api/iflows/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
  return handleResponse(res);
}

// ─── Internal mapper ──────────────────────────────────────────────────────────
function mapIFlow(raw, packageName) {
  return {
    id: raw.Id,
    name: raw.Name,
    packageId: raw.PackageId,
    packageName: packageName || raw.PackageId,
    version: raw.Version,
    status: "not deployed",
    deployedBy: "-",
  };
}
