import { useState, useRef } from "react";
import { Modal, ModalTitle, ModalActions } from "./Modal";
import { Button, FormRow, inputStyle, Spinner } from "./UI";
import { Upload, FileArchive } from "lucide-react";

export function UploadModal({ packages, env, onUpload, onClose }) {
  const [name, setName]       = useState("");
  const [version, setVersion] = useState("");
  const [pkgId, setPkgId]     = useState(packages[0]?.id || "");
  const [file, setFile]       = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const fileRef = useRef();

  const selectedPkg = packages.find(p => p.id === pkgId);

  const handleFile = f => {
    if (f && f.name.endsWith(".zip")) { setFile(f); setError(""); }
    else setError("Only .zip files are supported.");
  };

  const handleSubmit = async () => {
    if (!name.trim())    return setError("iFlow name is required.");
    if (!version.trim()) return setError("Version is required.");
    if (!file)           return setError("Please select a .zip file.");
    setError("");
    setLoading(true);
    try {
      await onUpload({ name: name.trim(), version: version.trim(), packageId: pkgId, packageName: selectedPkg?.name, env, file });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Upload iFlow to {env}</ModalTitle>

      <FormRow label="iFlow name *">
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CreateSalesOrder" />
      </FormRow>

      <FormRow label="Version *">
        <input style={inputStyle} value={version} onChange={e => setVersion(e.target.value)} placeholder="e.g. 1.0.0" />
      </FormRow>

      <FormRow label="Package *">
        <select style={inputStyle} value={pkgId} onChange={e => setPkgId(e.target.value)}>
          {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </FormRow>

      <FormRow label=".zip file *">
        <div
          onClick={() => fileRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          style={{
            border: `2px dashed ${dragOver ? "#378ADD" : "#D8D6CF"}`,
            borderRadius: 8, padding: "1.5rem", textAlign: "center",
            cursor: "pointer", color: dragOver ? "#185FA5" : "#6B6963",
            background: dragOver ? "#E6F1FB" : "#FAFAF8",
            fontSize: 13, transition: "all 0.15s",
          }}
        >
          {file ? (
            <>
              <FileArchive size={22} style={{ display: "block", margin: "0 auto 6px" }} />
              {file.name}
            </>
          ) : (
            <>
              <Upload size={22} style={{ display: "block", margin: "0 auto 6px" }} />
              Click or drag a .zip file here
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".zip" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
      </FormRow>

      {error && <p style={{ fontSize: 12, color: "#791F1F", marginBottom: "0.5rem" }}>{error}</p>}

      <ModalActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? <><Spinner size={13} /> Uploading…</> : <><Upload size={13} /> Upload</>}
        </Button>
      </ModalActions>
    </Modal>
  );
}
