import { useState, useEffect } from "react";
import { Trash2, Settings } from "lucide-react";
import ModalShell from "./ModalShell";
import { API_URL, apiFetch, apiErrorMessage } from "../api";
import type { ImportHistory, ImportSettings } from "../types";

export default function SettingsModal({
  onClose,
  onConversationsChanged,
}: {
  onClose: () => void;
  onConversationsChanged?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'import' | 'history'>('import');
  const [settings, setSettings] = useState<ImportSettings | null>(null);
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadHistory();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiFetch(`${API_URL}/settings/import`);
      const data = await response.json();
      setSettings(data);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load settings:", error);
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await apiFetch(`${API_URL}/import/history?page_size=20`);
      const data = await response.json();
      setHistory(data.items || []);
    } catch (error) {
      console.error("Failed to load import history:", error);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    
    setSaving(true);
    setSaveError(null);
    try {
      const response = await apiFetch(`${API_URL}/settings/import`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        const updated = await response.json();
        setSettings(updated);
      } else {
        const errorData = await response.json().catch(() => null);
        setSaveError(apiErrorMessage(errorData, "Failed to save settings."));
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof ImportSettings>(key: K, value: ImportSettings[K]) => {
    if (!settings) return;
    const next: ImportSettings = { ...settings, [key]: value };
    if (key === "auto_merge_duplicates" && value === true) {
      next.keep_separate = false;
    }
    if (key === "keep_separate" && value === true) {
      next.auto_merge_duplicates = false;
    }
    setSettings(next);
  };

  const handleDeleteImport = async (historyId: number) => {
    const message = "Delete this import and all its conversations? This cannot be undone.";
    if (!confirm(message)) return;
    
    try {
      const response = await apiFetch(`${API_URL}/import/history/${historyId}?delete_conversations=true`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete import");
      }
      
      const result = await response.json();
      alert(`Deleted import and ${result.deleted_conversations} conversation(s)`);
      
      await loadHistory();
      onConversationsChanged?.();
    } catch (error) {
      console.error("Failed to delete import:", error);
      alert("Failed to delete import");
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", { 
      year: "numeric", 
      month: "short", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: { [key: string]: string } = {
      success: '#10b981',
      failure: '#ef4444',
      partial: '#f59e0b',
      processing: '#3b82f6'
    };
    return (
      <span style={{
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        backgroundColor: colors[status] || '#6b7280',
        color: 'white'
      }}>
        {status}
      </span>
    );
  };

  return (
    <ModalShell title="Import & Export Settings" onClose={onClose} className="settings-modal">
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        <button 
          className={activeTab === 'import' ? 'active' : ''} 
          onClick={() => setActiveTab('import')}
          role="tab"
          aria-selected={activeTab === 'import'}
        >
          Import Settings
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''} 
          onClick={() => setActiveTab('history')}
          role="tab"
          aria-selected={activeTab === 'history'}
        >
          Import History
        </button>
      </div>

      <div className="settings-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : activeTab === 'import' && settings ? (
          <div className="settings-panel">
            <div className="settings-section">
              <h3>File Format Preferences</h3>
              <div className="form-group">
                <label>Allowed Formats (comma-separated):</label>
                <input
                  type="text"
                  value={settings.allowed_formats}
                  onChange={(e) => updateSetting('allowed_formats', e.target.value)}
                  placeholder="json"
                />
                <small>Only JSON imports are supported. Files whose extension is not in this list are rejected.</small>
              </div>
              <div className="form-group">
                <label>Default Format:</label>
                <select
                  value={settings.default_format}
                  onChange={(e) => updateSetting('default_format', e.target.value)}
                >
                  <option value="json">JSON</option>
                </select>
              </div>
            </div>

            <div className="settings-section">
              <h3>Import Behavior</h3>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.auto_merge_duplicates}
                    onChange={(e) => updateSetting('auto_merge_duplicates', e.target.checked)}
                  />
                  Auto-merge duplicate conversations
                </label>
                <small>Automatically merge imported conversations with existing ones if they have the same source ID. Turns off keep-separate.</small>
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.keep_separate}
                    onChange={(e) => updateSetting('keep_separate', e.target.checked)}
                  />
                  Keep imported data separate
                </label>
                <small>Do not merge by source ID even if auto-merge is enabled. New imports are added as distinct conversations.</small>
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.skip_empty_conversations}
                    onChange={(e) => updateSetting('skip_empty_conversations', e.target.checked)}
                  />
                  Skip empty conversations
                </label>
                <small>Don't import conversations that have no messages</small>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={onClose}>Close</button>
              <button 
                className="primary" 
                onClick={handleSaveSettings}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
            {saveError && <div className="status-error">{saveError}</div>}
          </div>
        ) : (
          <div className="history-panel">
            <div className="history-header">
              <h3>Past Imports</h3>
              <p className="text-muted">View and manage your import history</p>
            </div>
            {history.length === 0 ? (
              <div className="empty">No import history yet</div>
            ) : (
              <div className="history-list">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>File Name</th>
                      <th>Source</th>
                      <th>Format</th>
                      <th>Status</th>
                      <th>Imported</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.created_at)}</td>
                        <td className="filename">{item.filename}</td>
                        <td>{item.source_type}</td>
                        <td>{item.file_format.toUpperCase()}</td>
                        <td>{getStatusBadge(item.status)}</td>
                        <td>{item.imported_count} conversations</td>
                        <td>
                          <button
                            className="icon-btn delete-import-btn"
                            onClick={() => handleDeleteImport(item.id)}
                            title="Delete this import and its conversations"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {history.some(h => h.error_message) && (
                  <div className="error-details">
                    <h4>Error Details</h4>
                    {history.filter(h => h.error_message).map(h => (
                      <div key={h.id} className="error-item">
                        <strong>{h.filename}:</strong> {h.error_message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
