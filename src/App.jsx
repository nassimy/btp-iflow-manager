import { useState, useEffect, useCallback, useRef } from "react";
import { fetchPackages, fetchIFlows, fetchRuntimeArtifacts, deployIFlow, deleteIFlow } from "./api";
import { useAuth } from "./useAuth";
import { IFlowTable } from "./components/IFlowTable";
import { IFlowDetailPanel } from "./components/IFlowDetailPanel";
import { PackagesView } from "./components/PackagesView";
import { ConfirmDeployModal, ConfirmDeleteModal, ConfirmRedeployModal, ConfirmBulkModal } from "./components/ConfirmModal";
import { MaintenanceTab } from "./components/MaintenanceTab";
import { Button, Spinner } from "./components/UI";
import { Toast, useToast } from "./components/Toast";
import { RefreshCw, Play, PowerOff, Wrench, LayoutDashboard, Timer, ChevronLeft, User } from "lucide-react";

const TABS = [
  { id: "dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { id: "maintenance", label: "Maintenance", icon: Wrench },
];

const AUTO_REFRESH_INTERVALS = [
  { label: "30s", value: 30 },
  { label: "60s", value: 60 },
  { label: "2m",  value: 120 },
  { label: "5m",  value: 300 },
];

export default function App() {
  const { user, authLoading, canView, canDeploy, canManage } = useAuth();

  const [activeTab, setActiveTab]             = useState("dashboard");
  const [view, setView]                       = useState("packages");
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [packages, setPackages]               = useState([]);
  const [iflows, setIFlows]                   = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [search, setSearch]                   = useState("");
  const [statusFilter, setStatusFilter]       = useState("");
  const [deployTarget, setDeployTarget]       = useState(null);
  const [deleteTarget, setDeleteTarget]       = useState(null);
  const [redeployTarget, setRedeployTarget]   = useState(null);
  const [detailTarget, setDetailTarget]       = useState(null);
  const [selected, setSelected]               = useState(new Set());
  const [bulkAction, setBulkAction]           = useState(null);
  const [autoRefresh, setAutoRefresh]         = useState(false);
  const [autoInterval, setAutoInterval]       = useState(30);
  const [countdown, setCountdown]             = useState(0);
  const autoRefreshRef                        = useRef(null);
  const countdownRef                          = useRef(null);
  const { toast, show: showToast }            = useToast();

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

  useEffect(() => {
    if (!authLoading && canView) load();
  }, [authLoading, canView, load]);

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(autoRefreshRef.current);
    clearInterval(countdownRef.current);
    if (!autoRefresh) { setCountdown(0); return; }
    setCountdown(autoInterval);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? autoInterval : prev - 1));
    }, 1000);
    autoRefreshRef.current = setInterval(() => { load(true); }, autoInterval * 1000);
    return () => {
      clearInterval(autoRefreshRef.current);
      clearInterval(countdownRef.current);
    };
  }, [autoRefresh, autoInterval, load]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDeploy = async (id) => {
    await deployIFlow(id);
    setTimeout(() => load(true), 3000);
    showToast("Deploy triggered — status will update shortly.", "info");
  };

  const handleRedeploy = async (id) => {
    await deployIFlow(id);
    setTimeout(() => load(true), 3000);
    showToast("Redeploy triggered — status will update shortly.", "info");
  };

  const handleDelete = async (id) => {
    await deleteIFlow(id);
    await load(true);
    showToast("iFlow undeployed successfully.", "success");
  };

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

  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
    setView("iflows");
    setSearch("");
    setStatusFilter("");
    setSelected(new Set());
  };

  const handleBack = () => {
    setView("packages");
    setSelectedPackage(null);
    setSearch("");
    setStatusFilter("");
    setSelected(new Set());
  };

  // ── Filtered iflows ───────────────────────────────────────────────────────
  const packageIFlows = selectedPackage
    ? iflows.filter(f => f.packageId === selectedPackage.id)
    : iflows;

  const visible = packageIFlows.filter((f) => {
    if (statusFilter && f.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!f.name.toLowerCase().includes(q) && !f.id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const stats = {
    total:       visible.length,
    started:     visible.filter(f => f.status === "started").length,
    error:       visible.filter(f => f.status === "error").length,
    notDeployed: visible.filter(f => f.status === "not deployed").length,
  };

  const selectedIFlows    = iflows.filter(f => selected.has(f.id));
  const deployableCount   = selectedIFlows.filter(f => f.status === "not deployed").length;
  const undeployableCount = selectedIFlows.filter(f => f.status !== "not deployed").length;

  const inputStyle = {
    fontSize: 13, padding: "5px 10px", height: 32,
    borderRadius: 7, border: "1px solid #D8D6CF",
    background: "#fff", color: "#1A1A18", fontFamily: "inherit",
  };

  const STAT_CARDS = [
    { label: "Total",        key: "total",       color: "#1A1A18" },
    { label: "Running",      key: "started",     color: "#27500A" },
    { label: "Errors",       key: "error",       color: "#A32D2D" },
    { label: "Not deployed", key: "notDeployed", color: "#854F0B" },
  ];

  // ── Loading / Access denied states ────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F7F6F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spinner size={28} />
      </div>
    );
  }

  if (!canView) {
    return (
      <div style={{ minHeight: "100vh", background: "#F7F6F2", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1A18" }}>Access Denied</div>
        <div style={{ fontSize: 13, color: "#6B6963", maxWidth: 340, textAlign: "center" }}>
          You don't have the <strong>Viewer</strong> role for this application.
          Contact your BTP administrator to request access.
        </div>
        {user?.email && (
          <div style={{ fontSize: 12, color: "#9B9890", marginTop: 4 }}>Logged in as: {user.email}</div>
        )}
      </div>
    );
  }

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
          {/* User info chip */}
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 10px", height: 28, borderRadius: 14, background: "#F7F6F2", border: "1px solid #ECEAE3" }}>
              <User size={11} color="#6B6963" />
              <span style={{ fontSize: 11, color: "#6B6963", fontWeight: 500 }}>{user.name}</span>
              {/* Role badge */}
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 8,
                background: canManage ? "#E8F5E9" : canDeploy ? "#E3F0FB" : "#F7F6F2",
                color: canManage ? "#27500A" : canDeploy ? "#0C447C" : "#6B6963",
                border: `1px solid ${canManage ? "#A5D6A7" : canDeploy ? "#85B7EB" : "#D8D6CF"}`,
              }}>
                {canManage ? "Administrator" : canDeploy ? "Operator" : "Viewer"}
              </span>
            </div>
          )}
          {/* Auto-refresh */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", height: 32, borderRadius: 7, border: "1px solid #D8D6CF", background: autoRefresh ? "#E6F1FB" : "#fff" }}>
            <Timer size={13} color={autoRefresh ? "#0C447C" : "#9B9890"} />
            <span style={{ fontSize: 12, color: autoRefresh ? "#0C447C" : "#6B6963", fontWeight: 500 }}>Auto</span>
            <select
              value={autoInterval}
              onChange={e => setAutoInterval(Number(e.target.value))}
              style={{ fontSize: 12, border: "none", background: "transparent", color: autoRefresh ? "#0C447C" : "#6B6963", fontFamily: "inherit", cursor: "pointer", outline: "none" }}
            >
              {AUTO_REFRESH_INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
            <div onClick={() => setAutoRefresh(p => !p)} style={{ width: 32, height: 18, borderRadius: 9, cursor: "pointer", position: "relative", background: autoRefresh ? "#0C447C" : "#D8D6CF", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 2, left: autoRefresh ? 14 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </div>
            {autoRefresh && <span style={{ fontSize: 11, color: "#0C447C", fontWeight: 600, minWidth: 20 }}>{countdown}s</span>}
          </div>
          <Button onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
            Refresh
          </Button>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #ECEAE3", padding: "0 2rem", display: "flex", alignItems: "center" }}>
        {activeTab === "dashboard" && view === "iflows" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 24 }}>
            <button
              onClick={handleBack}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "#6B6963", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "0 4px", height: 44 }}
            >
              <ChevronLeft size={14} /> Packages
            </button>
            <span style={{ color: "#D8D6CF", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1A18" }}>{selectedPackage?.name}</span>
          </div>
        )}
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive  = activeTab === id;
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
              {showBadge && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E8A600", position: "absolute", top: 10, right: -6 }} />}
            </button>
          );
        })}
      </div>

      {/* ── Dashboard tab ── */}
      {activeTab === "dashboard" && (
        <>
          {view === "packages" && (
            <PackagesView
              packages={packages}
              iflows={iflows}
              loading={loading}
              onSelect={handlePackageSelect}
            />
          )}

          {view === "iflows" && (
            <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.75rem 1.5rem" }}>

              {/* Stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: "1.5rem" }}>
                {STAT_CARDS.map((s) => (
                  <div key={s.key} style={{ background: "#fff", border: "1px solid #ECEAE3", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 11, color: "#9B9890", fontWeight: 500, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{loading ? "—" : stats[s.key]}</div>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
                <input style={{ ...inputStyle, width: 210 }} placeholder="Search by name or ID…" value={search} onChange={e => setSearch(e.target.value)} />
                <select style={inputStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
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

              {/* Bulk action bar — only shown when user has deploy or manage scope */}
              {selected.size > 0 && (canDeploy || canManage) && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#E6F1FB", border: "1px solid #85B7EB", borderRadius: 8, padding: "8px 14px", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: 13, color: "#0C447C", fontWeight: 600 }}>
                    {selected.size} iFlow{selected.size !== 1 ? "s" : ""} selected
                  </span>
                  <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                    {canDeploy && (
                      <Button variant="success" style={{ height: 28, padding: "4px 10px", fontSize: 12 }}
                        onClick={() => setBulkAction({ action: "deploy", iflows: selectedIFlows.filter(f => f.status === "not deployed") })}
                        disabled={deployableCount === 0}>
                        <Play size={12} /> Deploy {deployableCount > 0 ? deployableCount : ""}
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="danger" style={{ height: 28, padding: "4px 10px", fontSize: 12 }}
                        onClick={() => setBulkAction({ action: "undeploy", iflows: selectedIFlows.filter(f => f.status !== "not deployed") })}
                        disabled={undeployableCount === 0}>
                        <PowerOff size={12} /> Undeploy {undeployableCount > 0 ? undeployableCount : ""}
                      </Button>
                    )}
                    <Button style={{ height: 28, padding: "4px 10px", fontSize: 12 }} onClick={() => setSelected(new Set())}>Clear</Button>
                  </div>
                </div>
              )}

              {/* Table — pass role flags so row-level buttons are hidden too */}
              <div style={{ background: "#fff", border: "1px solid #ECEAE3", borderRadius: 10 }}>
                {loading
                  ? <div style={{ textAlign: "center", padding: "3rem", color: "#6B6963" }}><Spinner size={24} /></div>
                  : <IFlowTable
                      iflows={visible}
                      onDeploy={canDeploy ? setDeployTarget : null}
                      onDelete={canManage ? setDeleteTarget : null}
                      onRedeploy={canDeploy ? setRedeployTarget : null}
                      onDetail={setDetailTarget}
                      selected={selected}
                      onToggle={handleToggle}
                      onToggleAll={handleToggleAll}
                    />
                }
              </div>
            </main>
          )}
        </>
      )}

      {/* ── Maintenance tab ── */}
      {activeTab === "maintenance" && (
        <MaintenanceTab iflows={iflows} onRefresh={load} canDeploy={canDeploy} canManage={canManage} />
      )}

      {deployTarget   && <ConfirmDeployModal   iflow={deployTarget}   onConfirm={handleDeploy}   onClose={() => setDeployTarget(null)} />}
      {redeployTarget && <ConfirmRedeployModal iflow={redeployTarget} onConfirm={handleRedeploy} onClose={() => setRedeployTarget(null)} />}
      {deleteTarget   && <ConfirmDeleteModal   iflow={deleteTarget}   onConfirm={handleDelete}   onClose={() => setDeleteTarget(null)} />}
      {detailTarget   && <IFlowDetailPanel     iflow={detailTarget}                              onClose={() => setDetailTarget(null)} />}
      {bulkAction     && (
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