import { useState, useEffect } from "react";
import { Sparkles, Upload, Search, Menu, Sun, Moon, MoreVertical, Trash2, Download, Tag, Settings } from "lucide-react";

const API_URL = "http://localhost:8000";

type Conversation = {
  id: number;
  source: string;
  source_id?: string | null;
  title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  message_count: number;
};

type Message = {
  id: number;
  role: string;
  content: string;
  created_at?: string | null;
  order_index: number;
};

type ConversationDetail = Conversation & {
  messages: Message[];
};

type ImportHistory = {
  id: number;
  filename: string;
  source_location?: string | null;
  source_type: string;
  file_format: string;
  status: string;
  created_at: string;
  imported_count: number;
  error_message?: string | null;
};

type ImportSettings = {
  id: number;
  allowed_formats: string;
  default_format: string;
  auto_merge_duplicates: boolean;
  keep_separate: boolean;
  skip_empty_conversations: boolean;
  updated_at: string;
};

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showMenu, setShowMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const loadConversations = async () => {
    try {
      const response = await fetch(`${API_URL}/conversations?page_size=100`);
      const data = await response.json();
      setConversations(data.items || []);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load conversations:", error);
      setLoading(false);
    }
  };

  const loadConversation = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/conversations/${id}`);
      const data = await response.json();
      setSelectedConversation(data);
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      loadConversations();
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/conversations/search?q=${encodeURIComponent(query)}&page_size=100`
      );
      const data = await response.json();
      setConversations(data.items || []);
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  const extractTags = (title: string | null | undefined): string[] => {
    if (!title) return [];
    const words = title.split(/\s+/);
    return words.slice(0, 2).filter(w => w.length > 3);
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  const getPreview = (title: string | null | undefined): string => {
    if (!title) return "Untitled conversation";
    return title.length > 60 ? title.slice(0, 60) + "..." : title;
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation || !confirm('Delete this conversation?')) return;
    
    try {
      await fetch(`${API_URL}/conversations/${selectedConversation.id}`, {
        method: 'DELETE'
      });
      setSelectedConversation(null);
      loadConversations();
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <Sparkles size={20} />
            {!sidebarCollapsed && <span>ChatArchive</span>}
          </div>
          <button className="icon-btn" title="Toggle theme" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <button className="import-btn" onClick={() => setShowImportModal(true)}>
          <Upload size={16} />
          Import
        </button>

        <button className="settings-btn" onClick={() => setShowSettingsModal(true)}>
          <Settings size={16} />
          Settings
        </button>

        <div className="conversations-list">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="empty">No conversations yet</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${selectedConversation?.id === conv.id ? "active" : ""}`}
                onClick={() => loadConversation(conv.id)}
              >
                <div className="conv-header">
                  <h3 className="conv-title">{conv.title || "Untitled"}</h3>
                  <span className="conv-date">{formatDate(conv.created_at)}</span>
                </div>
                <p className="conv-preview">{getPreview(conv.title)}</p>
                <div className="conv-tags">
                  {extractTags(conv.title).map((tag, i) => (
                    <span key={i} className="tag">{tag}</span>
                  ))}
                  <span className="tag source">{conv.source}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <button className="icon-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <Menu size={20} />
          </button>
          <h2 className="header-title">
            {selectedConversation?.title || "Select a conversation"}
          </h2>
          {selectedConversation && (
            <div className="header-actions">
              <button className="icon-btn" onClick={() => setShowMenu(!showMenu)} title="More options">
                <MoreVertical size={20} />
              </button>
              {showMenu && (
                <div className="dropdown-menu">
                  <button className="menu-item" onClick={handleDeleteConversation}>
                    <Trash2 size={16} />
                    Delete conversation
                  </button>
                  <button className="menu-item" onClick={() => setShowMenu(false)}>
                    <Download size={16} />
                    Export as Markdown
                  </button>
                  <button className="menu-item" onClick={() => setShowMenu(false)}>
                    <Tag size={16} />
                    Add tags
                  </button>
                </div>
              )}
            </div>
          )}
        </header>

        <div className="content-area">
          {!selectedConversation ? (
            <div className="welcome-state">
              <Sparkles size={48} className="welcome-icon" />
              <h2>Welcome to ChatArchive</h2>
              <p>Select a conversation from the sidebar or import your chat history to get started</p>
            </div>
          ) : (
            <div className="conversation-view">
              {selectedConversation.messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className="message-role">{msg.role === "user" ? "You" : "Assistant"}</div>
                  <div className="message-content">
                    {msg.content.split("\n").map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} onSuccess={loadConversations} />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}
    </div>
  );
}

function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setStatus("Uploading...");
      setError(null);
      const response = await fetch(`${API_URL}/import/chatgpt`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Import failed");
      }

      const data = await response.json();
      setStatus(`Imported ${data.length} conversations!`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Import Conversations</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="file"
            accept="application/json"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary">Import</button>
          </div>
        </form>
        {status && <div className="status-success">{status}</div>}
        {error && <div className="status-error">{error}</div>}
      </div>
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'import' | 'history'>('import');
  const [settings, setSettings] = useState<ImportSettings | null>(null);
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    loadHistory();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/settings/import`);
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
      const response = await fetch(`${API_URL}/import/history?page_size=20`);
      const data = await response.json();
      setHistory(data.items || []);
    } catch (error) {
      console.error("Failed to load import history:", error);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/settings/import`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        const updated = await response.json();
        setSettings(updated);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof ImportSettings>(key: K, value: ImportSettings[K]) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", { 
      year: "numeric", 
      month: "short", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import & Export Settings</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-tabs">
          <button 
            className={activeTab === 'import' ? 'active' : ''} 
            onClick={() => setActiveTab('import')}
          >
            Import Settings
          </button>
          <button 
            className={activeTab === 'history' ? 'active' : ''} 
            onClick={() => setActiveTab('history')}
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
                    placeholder="json,csv,xml"
                  />
                  <small>Supported: json, csv, xml</small>
                </div>
                <div className="form-group">
                  <label>Default Format:</label>
                  <select
                    value={settings.default_format}
                    onChange={(e) => updateSetting('default_format', e.target.value)}
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                    <option value="xml">XML</option>
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
                  <small>Automatically merge imported conversations with existing ones if they have the same source ID</small>
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
                  <small>Create separate archives for each import instead of merging with existing data</small>
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
            </div>
          ) : (
            <div className="history-panel">
              <div className="history-header">
                <h3>Past Imports</h3>
                <p className="text-muted">View logs of all your imports</p>
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
      </div>
    </div>
  );
}
