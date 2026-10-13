import React, { useState, useEffect } from "react";
import { Download, Settings } from "lucide-react";
import ModalShell from "./ModalShell";
import { API_URL, apiFetch, apiErrorMessage } from "../api";
import type { ImportSettings, BundleImportResult } from "../types";

export default function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'chatgpt' | 'claude' | 'gemini' | 'copilot'>('chatgpt');
  const [settings, setSettings] = useState<ImportSettings | null>(null);
  const [importing, setImporting] = useState(false);
  const [bundleResult, setBundleResult] = useState<BundleImportResult | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiFetch(`${API_URL}/settings/import`);
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  type SourceInfo = {
    name: string;
    description: string;
    icon: string;
    exportUrl?: string;
    exportSteps: string[];
  };

  const sourceInfo: Record<'chatgpt' | 'claude' | 'gemini' | 'copilot', SourceInfo> = {
    chatgpt: {
      name: 'ChatGPT',
      description: 'OpenAI export ZIP (preferred) or conversations.json',
      icon: '💬',
      exportUrl: 'https://chatgpt.com/#settings/DataControls',
      exportSteps: [
        'Go to ChatGPT Settings → Data Controls → Export Data',
        'Click "Export" and wait for the email confirmation',
        'Download the archive and import the untouched ZIP to preserve available projects and files',
      ],
    },
    claude: {
      name: 'Claude',
      description: 'Anthropic export ZIP (preferred) or conversations.json',
      icon: '🤖',
      exportUrl: 'https://claude.ai/settings',
      exportSteps: [
        'Visit claude.ai/settings',
        'Navigate to "Data & Privacy"',
        'Click "Request your data export"',
        'Wait for the email with your export (may take a few hours)',
        'Download the archive and import the untouched ZIP to preserve available artifacts',
      ],
    },
    gemini: {
      name: 'Gemini',
      description: 'Google Gemini/Bard conversation export',
      icon: '✨',
      exportUrl: 'https://takeout.google.com/',
      exportSteps: [
        'Visit Google Takeout',
        'Deselect all products, then select only "Gemini Apps Activity"',
        'Choose JSON format and create export',
        'Wait for the download link, then download and extract',
        'Import Takeout/My Activity/Gemini Apps/MyActivity.json',
      ],
    },
    copilot: {
      name: 'GitHub Copilot',
      description: 'GitHub Copilot Chat conversation export',
      icon: '👨‍💻',
      exportSteps: [
        'In VS Code: Extensions → Copilot → Settings → Export Chat History',
        'Or on GitHub.com: Visit your Copilot settings and request an export',
        'Download the JSON file',
      ],
    },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file");
      return;
    }
    const isBundle = file.name.toLowerCase().endsWith(".zip");
    if (isBundle && source !== "chatgpt" && source !== "claude") {
      setError("ZIP bundle import is currently available for ChatGPT and Claude only");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setImporting(true);
      setBundleResult(null);
      setStatus(isBundle ? "Uploading and validating bundle…" : "Uploading…");
      setError(null);
      const endpoint = isBundle ? `/import/${source}/bundle` : `/import/${source}`;
      const response = await apiFetch(`${API_URL}${endpoint}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(apiErrorMessage(errorData, "Import failed"));
      }

      const data = await response.json();
      if (isBundle) {
        const result = data as BundleImportResult;
        setBundleResult(result);
        setStatus(
          result.status === "partial"
            ? "Bundle imported with some unavailable resources."
            : "Bundle import complete.",
        );
        onSuccess();
        return;
      }
      const countMsg = data.length === 1 ? "1 conversation" : `${data.length} conversations`;
      const dupeMsg = settings?.auto_merge_duplicates ? " (existing conversations updated)" : "";
      setStatus(`Imported ${countMsg} from ${sourceInfo[source].name}!${dupeMsg}`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <ModalShell title="Import Conversations" onClose={onClose} className="import-modal">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="source-select">Select Source</label>
          <select 
            id="source-select"
            value={source} 
            onChange={(e) => setSource(e.target.value as typeof source)}
            className="source-select"
          >
            {Object.entries(sourceInfo).map(([key, info]) => (
              <option key={key} value={key}>
                {info.icon} {info.name}
              </option>
            ))}
          </select>
          <p className="source-description">{sourceInfo[source].description}</p>
        </div>

        <details className="export-help">
          <summary>📥 Need your export file? Here's how to get it</summary>
          <ol>
            {sourceInfo[source].exportSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {sourceInfo[source].exportUrl && (
            <a href={sourceInfo[source].exportUrl} target="_blank" rel="noopener noreferrer" className="export-link">
              → Open {sourceInfo[source].name} export page
            </a>
          )}
        </details>

        <div className="form-group">
          <label htmlFor="file-input">Select File</label>
          <input
            id="file-input"
            type="file"
            accept=".json,application/json,.zip,application/zip"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setBundleResult(null);
              setStatus(null);
              setError(null);
            }}
            className="file-input"
          />
          {file && <p className="file-name">📄 {file.name}</p>}
          {file?.name.toLowerCase().endsWith(".zip") && source !== "chatgpt" && source !== "claude" && (
            <p className="status-error">Choose ChatGPT or Claude to import a ZIP bundle.</p>
          )}
        </div>

        {settings?.auto_merge_duplicates && (
          <div className="import-info">
            ℹ️ Auto-merge duplicates is enabled. Existing conversations with the same source ID will be updated.
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={!file || importing}>
            {importing ? "Importing…" : `Import from ${sourceInfo[source].name}`}
          </button>
        </div>
      </form>
      {status && <div className="status-success" aria-live="polite">{status}</div>}
      {error && <div className="status-error">{error}</div>}
      {bundleResult && (
        <section className="bundle-import-summary" aria-label="Bundle import summary">
          <div className="bundle-summary-grid">
            <div><strong>{bundleResult.conversations.imported}</strong><span>conversations added</span></div>
            <div><strong>{bundleResult.conversations.updated}</strong><span>conversations updated</span></div>
            <div><strong>{bundleResult.projects.created}</strong><span>projects created</span></div>
            <div><strong>{bundleResult.resources.stored + bundleResult.resources.inline}</strong><span>resources available</span></div>
            <div><strong>{bundleResult.resources.metadata_only}</strong><span>metadata only</span></div>
            <div><strong>{bundleResult.resources.unavailable}</strong><span>unavailable</span></div>
          </div>
          {bundleResult.warnings.length > 0 && (
            <div className="bundle-warning-list">
              <h3>Import notes</h3>
              <ul>
                {bundleResult.warnings.map((warning, index) => (
                  <li key={`${warning.code}-${warning.entry || index}`}>
                    <strong>{warning.code.split("_").join(" ").toLowerCase()}</strong>
                    <span>{warning.message}</span>
                    {warning.entry && <code>{warning.entry}</code>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="primary" onClick={onClose}>Done</button>
          </div>
        </section>
      )}
    </ModalShell>
  );
}
