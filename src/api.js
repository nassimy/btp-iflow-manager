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

// ── GET iFlows per package (loop over all packages) ───────────────────────────
// BTP returns "Not Implemented" when calling /IntegrationDesigntimeArtifacts
// without a packageId — so we fetch per package and merge.
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
  return mapIFlow(data?.d || data, packageId);
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
