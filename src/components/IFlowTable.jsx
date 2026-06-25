import { useState, useEffect } from "react";
import { StatusBadge, Button } from "./UI";
import { Play, PowerOff, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const TH = ({ children, style }) => (
  <th style={{
    textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6B6963",
    padding: "8px 12px", borderBottom: "1px solid #ECEAE3",
    whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em",
    ...style,
  }}>
    {children}
  </th>
);

const TD = ({ children, style }) => (
  <td style={{ padding: "10px 12px", verticalAlign: "middle", ...style }}>
    {children}
  </td>
);

const PAGE_SIZES = [10, 25, 50, 100];

function Pagination({ page, totalPages, pageSize, totalItems, onPage, onPageSize }) {
  if (totalItems === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, totalItems);

  const btnStyle = (disabled) => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 28, height: 28, borderRadius: 6,
    border: "1px solid #D8D6CF", background: disabled ? "#FAFAF8" : "#fff",
    color: disabled ? "#C0BDB6" : "#1A1A18", cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12, fontFamily: "inherit",
  });

  const pages = [];
  const add = (n) => { if (n >= 1 && n <= totalPages && !pages.includes(n)) pages.push(n); };
  add(1); add(page - 1); add(page); add(page + 1); add(totalPages);
  pages.sort((a, b) => a - b);

  const withEllipsis = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) withEllipsis.push("…");
    withEllipsis.push(pages[i]);
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 8,
      padding: "10px 14px", borderTop: "1px solid #ECEAE3", background: "#FAFAF8",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: "#6B6963" }}>
          {from}–{to} of {totalItems} iFlow{totalItems !== 1 ? "s" : ""}
        </span>
        <select
          value={pageSize}
          onChange={e => onPageSize(Number(e.target.value))}
          style={{
            fontSize: 12, padding: "3px 6px", height: 28, borderRadius: 6,
            border: "1px solid #D8D6CF", background: "#fff", color: "#1A1A18",
            fontFamily: "inherit", cursor: "pointer",
          }}
        >
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s} per page</option>)}
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button style={btnStyle(page === 1)} disabled={page === 1} onClick={() => onPage(1)} title="First page"><ChevronsLeft size={13} /></button>
        <button style={btnStyle(page === 1)} disabled={page === 1} onClick={() => onPage(page - 1)} title="Previous page"><ChevronLeft size={13} /></button>
        {withEllipsis.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} style={{ fontSize: 12, color: "#9B9890", padding: "0 4px" }}>…</span>
          ) : (
            <button key={p} onClick={() => onPage(p)} style={{
              ...btnStyle(false),
              background: p === page ? "#1A1A18" : "#fff",
              color: p === page ? "#fff" : "#1A1A18",
              border: p === page ? "1px solid #1A1A18" : "1px solid #D8D6CF",
              fontWeight: p === page ? 700 : 400,
            }}>{p}</button>
          )
        )}
        <button style={btnStyle(page === totalPages)} disabled={page === totalPages} onClick={() => onPage(page + 1)} title="Next page"><ChevronRight size={13} /></button>
        <button style={btnStyle(page === totalPages)} disabled={page === totalPages} onClick={() => onPage(totalPages)} title="Last page"><ChevronsRight size={13} /></button>
      </div>
    </div>
  );
}

export function IFlowTable({ iflows, onDeploy, onDelete, onRedeploy, onDetail, selected, onToggle, onToggleAll }) {
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey]   = useState("name");
  const [sortDir, setSortDir]   = useState("asc");

  useEffect(() => { setPage(1); }, [iflows.length]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const sorted = [...iflows].sort((a, b) => {
    const av = (a[sortKey] || "").toLowerCase();
    const bv = (b[sortKey] || "").toLowerCase();
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const start      = (safePage - 1) * pageSize;
  const paged      = sorted.slice(start, start + pageSize);

  const handlePageSize = (size) => { setPageSize(size); setPage(1); };

  // ── Sortable TH ───────────────────────────────────────────────────────────
  const SortTH = ({ label, sortId, style }) => {
    const isActive = sortKey === sortId;
    return (
      <th
        onClick={() => handleSort(sortId)}
        style={{
          textAlign: "left", fontSize: 11, fontWeight: 600, color: isActive ? "#1A1A18" : "#6B6963",
          padding: "8px 12px", borderBottom: "1px solid #ECEAE3",
          whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em",
          cursor: "pointer", userSelect: "none",
          ...style,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {label}
          <span style={{ fontSize: 10, color: isActive ? "#1A1A18" : "#C0BDB6" }}>
            {isActive ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
          </span>
        </span>
      </th>
    );
  };

  if (iflows.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6B6963", fontSize: 14 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
        No iFlows match the current filters.
      </div>
    );
  }

  const allChecked  = paged.length > 0 && paged.every(f => selected.has(f.id));
  const someChecked = paged.some(f => selected.has(f.id)) && !allChecked;

  return (
    <div style={{ borderRadius: 10, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#FAFAF8" }}>
              <TH style={{ width: 36, paddingRight: 0 }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked; }}
                  onChange={() => onToggleAll(paged)}
                  style={{ cursor: "pointer", width: 14, height: 14 }}
                  title="Select / deselect this page"
                />
              </TH>
              <SortTH label="Name / ID"   sortId="name" />
              <SortTH label="Version"     sortId="version" />
              <SortTH label="Status"      sortId="status" />
              <TH>Deployed by</TH>
              <TH style={{ textAlign: "right" }}>Actions</TH>
            </tr>
          </thead>
          <tbody>
            {paged.map((f, i) => {
              const isSelected = selected.has(f.id);
              const isDeployed = f.status !== "not deployed";
              return (
                <tr
                  key={f.id}
                  style={{
                    borderBottom: "1px solid #ECEAE3",
                    background: isSelected ? "#EFF6FF" : i % 2 === 0 ? "#fff" : "#FAFAF8",
                  }}
                  onMouseEnter={e => !isSelected && (e.currentTarget.style.background = "#F5F3EE")}
                  onMouseLeave={e => e.currentTarget.style.background = isSelected ? "#EFF6FF" : i % 2 === 0 ? "#fff" : "#FAFAF8"}
                >
                  <TD style={{ paddingRight: 0, width: 36 }}>
                    <input type="checkbox" checked={isSelected} onChange={() => onToggle(f.id)} style={{ cursor: "pointer", width: 14, height: 14 }} />
                  </TD>
                  <TD>
                    <div
                      onClick={() => onDetail(f)}
                      style={{ fontWeight: 600, color: "#0C447C", cursor: "pointer", display: "inline" }}
                      title="Click to view details"
                    >
                      {f.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#9B9890", marginTop: 1, fontFamily: "monospace" }}>{f.id}</div>
                  </TD>
                  <TD><span style={{ fontFamily: "monospace", fontSize: 12, color: "#6B6963" }}>{f.version}</span></TD>
                  <TD><StatusBadge status={f.status} /></TD>
                  <TD><span style={{ fontSize: 12, color: "#6B6963" }}>{f.deployedBy}</span></TD>
                  <TD style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {/* Smart Deploy/Redeploy button */}
                      <Button
                        variant={isDeployed ? "primary" : "success"}
                        onClick={() => isDeployed ? onRedeploy(f) : onDeploy(f)}
                        style={{ padding: "4px 10px", height: 28, fontSize: 12 }}
                        title={isDeployed ? "Redeploy running iFlow" : "Deploy iFlow to runtime"}
                      >
                        {isDeployed ? <><RotateCcw size={12} /> Redeploy</> : <><Play size={12} /> Deploy</>}
                      </Button>
                      {/* Undeploy — only when deployed */}
                      <Button
                        variant="danger"
                        onClick={() => onDelete(f)}
                        disabled={!isDeployed}
                        style={{ padding: "4px 10px", height: 28, fontSize: 12 }}
                        title={!isDeployed ? "iFlow is not deployed" : "Undeploy iFlow from runtime"}
                      >
                        <PowerOff size={12} /> Undeploy
                      </Button>
                    </div>
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        page={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={iflows.length}
        onPage={setPage}
        onPageSize={handlePageSize}
      />
    </div>
  );
}

