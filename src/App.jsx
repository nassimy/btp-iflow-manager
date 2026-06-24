import { useState, useEffect, useCallback } from "react";
import { fetchPackages, fetchIFlows, fetchRuntimeArtifacts, uploadIFlow, deployIFlow, deleteIFlow } from "./api";
import { IFlowTable } from "./components/IFlowTable";
import { UploadModal } from "./components/UploadModal";
import { ConfirmDeployModal, ConfirmDeleteModal, ConfirmBulkModal } from "./components/ConfirmModal";
import { MaintenanceTab } from "./components/MaintenanceTab";
import { Button, Spinner } from "./components/UI";
import { Toast, useToast } from "./components/Toast";
import { Upload, RefreshCw, Play, PowerOff, Wrench, LayoutDashboard } from "lucide-react";

const STAT_CARDS = [
  { label: "Total",        key: "total",       color: "#1A1A18" },
  { label: "Running",      key: "started",     color: "#27500A" },
  { label: "Errors",       key: "error",       color: "#A32D2D" },
  { label: "Not deployed", key: "notDeployed", color: "#854F0B" },
];

const TABS = [
  { id: "dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { id: "maintenance",  label: "Maintenance",  icon: Wrench },
];

export default function App() {
  const [activeTab, setActiveTab]       = useState("dashboard");
  const [packages, setPackages]         = useState([]);
  const [iflows, setIFlows]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState("");
  const [pkgFilter, setPkgFilter]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showUpload, setShowUpload]     = useState(false);
  const [deployTarget, setDeployTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selected, setSelected]         = useState(new Set());
  const [bulkAction, setBulkAction]     = useState(null);
  const { toast, show: showToast }      = useToast();

  // Check if a maintenance session is active (for tab badge)
  const hasMaintenanceSession = !!localStorage.getItem("iflow_maintenance_session");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const pkgs = await fetchPackages();
      setPackages(pkgs);
      const [flows, runtime] = await Promise.all([
        fetchIFlows(pkgs),
        fetchRuntimeArtifacts(),
      ]);
      const statusMap = Object.fromEntries(
        runtime.map((r) => [
          r.id,
          { status: r.status?.toLowerCase() || "not deployed", deployedBy: r.deployedBy },
        ])
      );
      const merged = flows.map((f) => ({
        ...f,
        status: statusMap[f.id]?.status || "not deployed",
        deployedBy: statusMap[f.id]?.deployedBy || "-",
      }));
      setIFlows(merged);
    } catch (err) {
      showToast(`Failed to load: ${err.message}`, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (data) => {
    await uploadIFlow(data);
    await load(true);
    showToast(`"${data.name}" uploaded successfully.`, "success");
  };

  const handleDeploy = async (id) => {
    await deployIFlow(id);
    setTimeout(() => load(true), 3000);
    showToast("Deploy triggered — status will update shortly.", "info");
  };

  const handleDelete = async (id) => {
    await deleteIFlow(id);
    await load(true);
    showToast("iFlow undeployed successfully.", "success");
  };

  // ── Selection helpers ──────────────────────────────────────────────────────
  const handleToggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleToggleAll = (visibleIflows) => {
    const allSelected = visibleIflows.every(f => selected.has(f.id));
    setSelected(prev => {
      const next = new Set(prev);
      visibleIflows.forEach(f => allSelected ? next.delete(f.id) : next.add(f.id));
      return next;
    });
  };

  const handleBulkConfirm = async (id) => {
    if (bulkAction.action === "deploy") await deployIFlow(id);
    else await deleteIFlow(id);
  };

  const handleBulkClose = () => {
    const action = bulkAction?.action;
    setBulkAction(null);
    setSelected(new Set());
    setTimeout(() => load(true), action === "deploy" ? 4000 : 1000);
    showToast(
      action === "deploy"
        ? "Bulk deploy triggered — statuses will update shortly."
        : "iFlows undeployed successfully.",
      action === "deploy" ? "info" : "success"
    );
  };

  const visible = iflows.filter((f) => {
    if (pkgFilter && f.packageId !== pkgFilter) return false;
    if (statusFilter && f.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!f.name.toLowerCase().includes(q) && !f.id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const stats = {
    total:       iflows.length,
    started:     iflows.filter((f) => f.status === "started").length,
    error:       iflows.filter((f) => f.status === "error").length,
    notDeployed: iflows.filter((f) => f.status === "not deployed").length,
  };

  const selectedIFlows    = iflows.filter(f => selected.has(f.id));
  const deployableCount   = selectedIFlows.filter(f => f.status === "not deployed").length;
  const undeployableCount = selectedIFlows.filter(f => f.status !== "not deployed").length;

  const inputStyle = {
    fontSize: 13, padding: "5px 10px", height: 32,
    borderRadius: 7, border: "1px solid #D8D6CF",
    background: "#fff", color: "#1A1A18", fontFamily: "inherit",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F6F2", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* ── Header ── */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #ECEAE3",
        padding: "0 2rem", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 56,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚙️</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A18" }}>iFlow Manager</span>
          <span style={{ fontSize: 11, color: "#9B9890", fontWeight: 500 }}>BTP Integration Suite</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
            Refresh
          </Button>
          {activeTab === "dashboard" && (
            <Button variant="primary" onClick={() => setShowUpload(true)}>
              <Upload size={13} /> Upload iFlow
            </Button>
          )}
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #ECEAE3", padding: "0 2rem", display: "flex", gap: 0 }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const showBadge = id === "maintenance" && hasMaintenanceSession;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "0 4px", height: 44, fontSize: 13, fontWeight: isActive ? 600 : 500,
                color: isActive ? "#1A1A18" : "#6B6963",
                background: "none", border: "none", borderBottom: isActive ? "2px solid #1A1A18" : "2px solid transparent",
                cursor: "pointer", fontFamily: "inherit", marginRight: 24, position: "relative",
                transition: "color 0.15s",
              }}
            >
              <Icon size={14} />
              {label}
              {showBadge && (
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: "#E8A600", position: "absolute", top: 10, right: -6,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Dashboard tab ── */}
      {activeTab === "dashboard" && (
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.75rem 1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: "1.5rem" }}>
            {STAT_CARDS.map((s) => (
              <div key={s.key} style={{ background: "#fff", border: "1px solid #ECEAE3", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: "#9B9890", fontWeight: 500, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{loading ? "—" : stats[s.key]}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
            <input style={{ ...inputStyle, width: 210 }} placeholder="Search by name or ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select style={inputStyle} value={pkgFilter} onChange={(e) => setPkgFilter(e.target.value)}>
              <option value="">All packages</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select style={inputStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="started">Started</option>
              <option value="stopped">Stopped</option>
              <option value="error">Error</option>
              <option value="not deployed">Not deployed</option>
            </select>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#9B9890" }}>
              {loading ? <Spinner size={13} /> : `${visible.length} iFlow${visible.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#E6F1FB", border: "1px solid #85B7EB",
              borderRadius: 8, padding: "8px 14px", marginBottom: "0.75rem",
            }}>
              <span style={{ fontSize: 13, color: "#0C447C", fontWeight: 600 }}>
                {selected.size} iFlow{selected.size !== 1 ? "s" : ""} selected
              </span>
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                <Button
                  variant="success"
                  style={{ height: 28, padding: "4px 10px", fontSize: 12 }}
                  onClick={() => setBulkAction({ action: "deploy", iflows: selectedIFlows.filter(f => f.status === "not deployed") })}
                  disabled={deployableCount === 0}
                  title={deployableCount === 0 ? "No undeployed iFlows selected" : `Deploy ${deployableCount} iFlow${deployableCount !== 1 ? "s" : ""}`}
                >
                  <Play size={12} /> Deploy {deployableCount > 0 ? deployableCount : ""}
                </Button>
                <Button
                  variant="danger"
                  style={{ height: 28, padding: "4px 10px", fontSize: 12 }}
                  onClick={() => setBulkAction({ action: "undeploy", iflows: selectedIFlows.filter(f => f.status !== "not deployed") })}
                  disabled={undeployableCount === 0}
                  title={undeployableCount === 0 ? "None of the selected iFlows are deployed" : `Undeploy ${undeployableCount} iFlow${undeployableCount !== 1 ? "s" : ""}`}
                >
                  <PowerOff size={12} /> Undeploy {undeployableCount > 0 ? undeployableCount : ""}
                </Button>
                <Button style={{ height: 28, padding: "4px 10px", fontSize: 12 }} onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div style={{ background: "#fff", border: "1px solid #ECEAE3", borderRadius: 10, overflow: "hidden" }}>
            {loading
              ? <div style={{ textAlign: "center", padding: "3rem", color: "#6B6963" }}><Spinner size={24} /></div>
              : <IFlowTable
                  iflows={visible}
                  onDeploy={setDeployTarget}
                  onDelete={setDeleteTarget}
                  selected={selected}
                  onToggle={handleToggle}
                  onToggleAll={handleToggleAll}
                />
            }
          </div>
        </main>
      )}

      {/* ── Maintenance tab ── */}
      {activeTab === "maintenance" && (
        <MaintenanceTab iflows={iflows} />
      )}

      {showUpload   && <UploadModal packages={packages} onUpload={handleUpload} onClose={() => setShowUpload(false)} />}
      {deployTarget && <ConfirmDeployModal iflow={deployTarget} onConfirm={handleDeploy} onClose={() => setDeployTarget(null)} />}
      {deleteTarget && <ConfirmDeleteModal iflow={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}
      {bulkAction   && (
        <ConfirmBulkModal
          iflows={bulkAction.iflows}
          action={bulkAction.action}
          onConfirm={handleBulkConfirm}
          onClose={handleBulkClose}
        />
      )}

      <Toast toast={toast} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}