import { useState, useEffect } from "react";
import { Sparkles, Upload, Search, Menu, Sun } from "lucide-react";

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

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

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

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <Sparkles size={20} />
            <span>ChatArchive</span>
          </div>
          <button className="icon-btn" title="Toggle theme">
            <Sun size={18} />
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
          <button className="icon-btn">
            <Menu size={20} />
          </button>
          <h2 className="header-title">
            {selectedConversation?.title || "Select a conversation"}
          </h2>
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
