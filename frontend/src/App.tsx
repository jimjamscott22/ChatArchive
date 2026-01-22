import { useState, useEffect } from "react";
import { Sparkles, Upload, Search, Menu, Sun, Moon, MoreVertical, Trash2, Download, Tag, Settings, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

const API_URL = "http://localhost:8000";
const PAGE_SIZE = 100;

type Conversation = {
  id: number;
  source: string;
  source_id?: string | null;
  title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  message_count: number;
  last_message_preview?: string | null;
  word_count?: number;
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

type DuplicateConversation = {
  id: number;
  source: string;
  source_id: string | null;
  title: string | null;
  created_at: string | null;
  updated_at: string | null;
  message_count: number;
};

type DuplicateGroup = {
  key: string;
  source: string;
  source_id: string | null;
  title: string | null;
  count: number;
  conversations: DuplicateConversation[];
  total_messages: number;
};

type DuplicatesData = {
  groups: DuplicateGroup[];
  total_duplicates: number;
  total_groups: number;
  strategy: string;
};

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showMenu, setShowMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
<<<<<<< HEAD
  const [selectedConversationIndex, setSelectedConversationIndex] = useState<number>(-1);
  const [showStats, setShowStats] = useState(false);
=======
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
>>>>>>> origin/main

  // Load conversations on mount
  useEffect(() => {
    refreshConversationList(1);
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // Ctrl/Cmd + K: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-box input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }

      // Ctrl/Cmd + I: Open import modal
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        setShowImportModal(true);
      }

      // Ctrl/Cmd + ,: Open settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setShowSettingsModal(true);
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        setShowImportModal(false);
        setShowSettingsModal(false);
        setShowMenu(false);
      }

      // Arrow keys: Navigate conversations
      if (e.key === 'ArrowDown' && conversations.length > 0) {
        e.preventDefault();
        const newIndex = Math.min(selectedConversationIndex + 1, conversations.length - 1);
        setSelectedConversationIndex(newIndex);
        loadConversation(conversations[newIndex].id);
      }

      if (e.key === 'ArrowUp' && conversations.length > 0) {
        e.preventDefault();
        const newIndex = Math.max(selectedConversationIndex - 1, 0);
        setSelectedConversationIndex(newIndex);
        loadConversation(conversations[newIndex].id);
      }

      // Ctrl/Cmd + E: Export current conversation
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && selectedConversation) {
        e.preventDefault();
        setShowMenu(!showMenu);
      }

      // Ctrl/Cmd + B: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed(!sidebarCollapsed);
      }

      // ?: Show keyboard shortcuts help
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        alert(`Keyboard Shortcuts:

⌘/Ctrl + K - Focus search
⌘/Ctrl + I - Open import
⌘/Ctrl + , - Settings
⌘/Ctrl + E - Export menu
⌘/Ctrl + B - Toggle sidebar
↑/↓ - Navigate conversations
ESC - Close modals
Shift + ? - Show help`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [conversations, selectedConversationIndex, selectedConversation, showMenu, sidebarCollapsed, theme]);

  // Update selected index when conversations change
  useEffect(() => {
    if (selectedConversation && conversations.length > 0) {
      const index = conversations.findIndex(c => c.id === selectedConversation.id);
      setSelectedConversationIndex(index);
    }
  }, [selectedConversation, conversations]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const loadConversations = async (source?: string, page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page_size: PAGE_SIZE.toString(),
        page: page.toString(),
      });
      if (source && source !== "all") {
        params.append("source", source);
      }
      const response = await fetch(`${API_URL}/conversations?${params}`);
      const data = await response.json();
      setConversations(data.items || []);
      setCurrentPage(data.page ?? page);
      setTotalPages(data.pages ?? 0);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load conversations:", error);
      setLoading(false);
    }
  };

  const loadSearchResults = async (query: string, page = 1, source?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        q: query,
        page_size: PAGE_SIZE.toString(),
        page: page.toString(),
      });
      if (source && source !== "all") {
        params.append("source", source);
      }
      const response = await fetch(`${API_URL}/conversations/search?${params}`);
      const data = await response.json();
      setConversations(data.items || []);
      setCurrentPage(data.page ?? page);
      setTotalPages(data.pages ?? 0);
      setLoading(false);
    } catch (error) {
      console.error("Search failed:", error);
      setLoading(false);
    }
  };

  const refreshConversationList = (page = currentPage, source?: string) => {
    const nextSource = source ?? sourceFilter;
    if (searchQuery.trim()) {
      loadSearchResults(searchQuery.trim(), page, nextSource);
      return;
    }
    loadConversations(nextSource, page);
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1) return;
    if (totalPages && nextPage > totalPages) return;
    refreshConversationList(nextPage);
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

  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    if (!query.trim()) {
      loadConversations(sourceFilter, 1);
      return;
    }

<<<<<<< HEAD
    setIsSearching(true);
    try {
      const response = await fetch(
        `${API_URL}/conversations/search?q=${encodeURIComponent(query)}&page_size=100`
      );
      const data = await response.json();
      setConversations(data.items || []);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
=======
    await loadSearchResults(query.trim(), 1, sourceFilter);
>>>>>>> origin/main
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

  const formatDateTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPreview = (title: string | null | undefined): string => {
    if (!title) return "Untitled conversation";
    return title.length > 60 ? title.slice(0, 60) + "..." : title;
  };

  const getMessagePreview = (conversation: Conversation): string => {
    if (conversation.last_message_preview) {
      return conversation.last_message_preview.length > 80 
        ? conversation.last_message_preview.slice(0, 80) + "..." 
        : conversation.last_message_preview;
    }
    return "No messages yet";
  };

  const getRelativeTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return formatDate(dateStr);
  };

  const estimateReadingTime = (wordCount?: number): string => {
    if (!wordCount || wordCount === 0) return "";
    const wordsPerMinute = 200;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return minutes === 1 ? "1 min read" : `${minutes} min read`;
  };

  const getSourceInfo = (source: string) => {
    const sources: Record<string, { icon: string; name: string; color: string }> = {
      chatgpt: { icon: '💬', name: 'ChatGPT', color: 'var(--chatgpt-color)' },
      claude: { icon: '🤖', name: 'Claude', color: 'var(--claude-color)' },
      gemini: { icon: '✨', name: 'Gemini', color: 'var(--gemini-color)' },
      copilot: { icon: '👨‍💻', name: 'Copilot', color: 'var(--copilot-color)' },
    };
    return sources[source] || { icon: '📝', name: source, color: 'var(--accent)' };
  };

  const handleSourceFilter = (source: string) => {
    setSourceFilter(source);
    setCurrentPage(1);
    if (searchQuery.trim()) {
      loadSearchResults(searchQuery.trim(), 1, source);
      return;
    }
    loadConversations(source, 1);
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation || !confirm('Delete this conversation?')) return;
    
    try {
      await fetch(`${API_URL}/conversations/${selectedConversation.id}`, {
        method: 'DELETE'
      });
      setSelectedConversation(null);
      refreshConversationList();
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const sanitizeFilename = (value: string): string => {
    return value
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
  };

  const getOrderedMessages = (conversation: ConversationDetail): Message[] => {
    return [...conversation.messages].sort((a, b) => a.order_index - b.order_index);
  };

  const getExportFilename = (conversation: ConversationDetail, extension: string): string => {
    const title = conversation.title || `conversation-${conversation.id}`;
    const safeTitle = sanitizeFilename(title) || `conversation-${conversation.id}`;
    return `${safeTitle}.${extension}`;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const escapeHtml = (value: string): string => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const buildMarkdownExport = (conversation: ConversationDetail): string => {
    const title = (conversation.title || "Untitled conversation").trim() || "Untitled conversation";
    const sourceName = getSourceInfo(conversation.source).name;
    const metaLines: string[] = [];

    if (sourceName) metaLines.push(`- Source: ${sourceName}`);
    if (conversation.source_id) metaLines.push(`- Source ID: ${conversation.source_id}`);
    if (conversation.created_at) metaLines.push(`- Created: ${formatDateTime(conversation.created_at)}`);
    if (conversation.updated_at) metaLines.push(`- Updated: ${formatDateTime(conversation.updated_at)}`);
    if (conversation.message_count) metaLines.push(`- Messages: ${conversation.message_count}`);

    const lines: string[] = [`# ${title}`];
    if (metaLines.length > 0) {
      lines.push("", ...metaLines);
    }
    lines.push("");

    const orderedMessages = getOrderedMessages(conversation);

    orderedMessages.forEach((msg, index) => {
      const roleLabel =
        msg.role === "user"
          ? "User"
          : msg.role === "assistant"
            ? "Assistant"
            : msg.role;
      lines.push(`## ${roleLabel}`, "");
      if (msg.content) {
        lines.push(msg.content.trimEnd());
      }
      if (index < orderedMessages.length - 1) {
        lines.push("", "---", "");
      }
    });

    return lines.join("\n").trim() + "\n";
  };

  const buildJsonExport = (conversation: ConversationDetail) => {
    const orderedMessages = getOrderedMessages(conversation);
    return {
      ...conversation,
      message_count: orderedMessages.length,
      messages: orderedMessages,
    };
  };

  const buildHtmlExport = (conversation: ConversationDetail): string => {
    const title = (conversation.title || "Untitled conversation").trim() || "Untitled conversation";
    const sourceName = getSourceInfo(conversation.source).name;
    const metaLines: string[] = [];

    if (sourceName) metaLines.push(`Source: ${sourceName}`);
    if (conversation.source_id) metaLines.push(`Source ID: ${conversation.source_id}`);
    if (conversation.created_at) metaLines.push(`Created: ${formatDateTime(conversation.created_at)}`);
    if (conversation.updated_at) metaLines.push(`Updated: ${formatDateTime(conversation.updated_at)}`);
    const messageCount = conversation.message_count || conversation.messages.length;
    metaLines.push(`Messages: ${messageCount}`);

    const orderedMessages = getOrderedMessages(conversation);
    const metaHtml = metaLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
    const messagesHtml = orderedMessages
      .map((msg) => {
        const roleLabel =
          msg.role === "user"
            ? "User"
            : msg.role === "assistant"
              ? "Assistant"
              : msg.role;
        const content = msg.content ? escapeHtml(msg.content) : "";
        return `
          <section class="message">
            <h2>${escapeHtml(roleLabel)}</h2>
            <div class="message-content">${content}</div>
          </section>
        `;
      })
      .join("\n");

    return `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)}</title>
          <style>
            :root {
              color: #111;
              font-family: "Helvetica Neue", Arial, sans-serif;
            }
            body {
              margin: 32px;
            }
            h1 {
              font-size: 28px;
              margin-bottom: 12px;
            }
            .meta {
              margin-bottom: 24px;
              padding-left: 18px;
              color: #444;
            }
            .message {
              margin-bottom: 24px;
              page-break-inside: avoid;
            }
            .message h2 {
              font-size: 18px;
              margin-bottom: 8px;
            }
            .message-content {
              white-space: pre-wrap;
              line-height: 1.5;
              background: #f6f6f6;
              border-radius: 8px;
              padding: 12px;
            }
            @media print {
              body {
                margin: 20mm;
              }
              .message-content {
                background: #fff;
                border: 1px solid #e5e5e5;
              }
            }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <ul class="meta">${metaHtml}</ul>
          ${messagesHtml}
        </body>
      </html>
    `;
  };

  const handleExportMarkdown = () => {
    if (!selectedConversation) return;

    const markdown = buildMarkdownExport(selectedConversation);
    const filename = getExportFilename(selectedConversation, "md");
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    downloadBlob(blob, filename);
    setShowMenu(false);
  };

  const handleExportJson = () => {
    if (!selectedConversation) return;

    const jsonPayload = buildJsonExport(selectedConversation);
    const filename = getExportFilename(selectedConversation, "json");
    const blob = new Blob([JSON.stringify(jsonPayload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    downloadBlob(blob, filename);
    setShowMenu(false);
  };

  const handleExportPdf = () => {
    if (!selectedConversation) return;

    const exportWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!exportWindow) {
      alert("Unable to open the export window. Please allow popups and try again.");
      return;
    }

    exportWindow.document.open();
    exportWindow.document.write(buildHtmlExport(selectedConversation));
    exportWindow.document.close();
    exportWindow.focus();

    const triggerPrint = () => {
      exportWindow.print();
    };

    exportWindow.onload = triggerPrint;
    exportWindow.onafterprint = () => {
      exportWindow.close();
    };
    setTimeout(triggerPrint, 300);
    setShowMenu(false);
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
          <div className="header-buttons">
            {!sidebarCollapsed && (
              <button className="icon-btn keyboard-shortcut-hint" title="Press Shift+? for keyboard shortcuts">
                <span className="keyboard-hint">⌨️</span>
              </button>
            )}
            <button className="icon-btn" title="Toggle theme" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
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

<<<<<<< HEAD
         {!sidebarCollapsed && (
           <>
             <div className="source-filter">
               <label>Filter by source:</label>
               <select value={sourceFilter} onChange={(e) => handleSourceFilter(e.target.value)}>
                 <option value="all">All Sources</option>
                 <option value="chatgpt">💬 ChatGPT</option>
                 <option value="claude">🤖 Claude</option>
                 <option value="gemini">✨ Gemini</option>
                 <option value="copilot">👨‍💻 Copilot</option>
               </select>
             </div>

             <div className="conversation-stats">
               <div className="stats-header" onClick={() => setShowStats(!showStats)}>
                 <span className="stats-title">Statistics</span>
                 <span className="stats-toggle">{showStats ? '▼' : '▶'}</span>
               </div>
               {showStats && (
                 <div className="stats-content">
                   <div className="stat-item">
                     <span className="stat-label">Total Conversations</span>
                     <span className="stat-value">{conversations.length}</span>
                   </div>
                   <div className="stat-item">
                     <span className="stat-label">Total Messages</span>
                     <span className="stat-value">
                       {conversations.reduce((sum, conv) => sum + conv.message_count, 0)}
                     </span>
                   </div>
                   <div className="source-breakdown">
                     <span className="stat-label">By Source</span>
                     {Object.entries(
                       conversations.reduce((acc, conv) => {
                         acc[conv.source] = (acc[conv.source] || 0) + 1;
                         return acc;
                       }, {} as Record<string, number>)
                     ).map(([source, count]) => (
                       <div key={source} className="source-stat">
                         <span className="source-indicator" data-source={source}>
                           {getSourceInfo(source).icon}
                         </span>
                         <span className="source-count">{count}</span>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
             </div>
           </>
         )}
=======
        <button className="duplicates-btn" onClick={() => setShowDuplicatesModal(true)}>
          <Copy size={16} />
          Find Duplicates
        </button>

        {!sidebarCollapsed && (
          <div className="source-filter">
            <label>Filter by source:</label>
            <select value={sourceFilter} onChange={(e) => handleSourceFilter(e.target.value)}>
              <option value="all">All Sources</option>
              <option value="chatgpt">💬 ChatGPT</option>
              <option value="claude">🤖 Claude</option>
              <option value="gemini">✨ Gemini</option>
              <option value="copilot">👨‍💻 Copilot</option>
            </select>
          </div>
        )}
>>>>>>> origin/main

        <div className="conversations-list">
          {loading || isSearching ? (
            <div className="skeleton-container">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-header">
                    <div className="skeleton-avatar"></div>
                    <div className="skeleton-info">
                      <div className="skeleton-title"></div>
                      <div className="skeleton-meta"></div>
                    </div>
                  </div>
                  <div className="skeleton-preview"></div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <h3>No conversations yet</h3>
              <p>Import your first conversation to get started with ChatArchive</p>
              <button className="empty-action-btn" onClick={() => setShowImportModal(true)}>
                <Upload size={16} />
                Import Conversations
              </button>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-card ${selectedConversation?.id === conv.id ? "active" : ""}`}
                onClick={() => loadConversation(conv.id)}
              >
                <div className="card-header">
                  <div className="card-left">
                    <div className="source-avatar" data-source={conv.source}>
                      {getSourceInfo(conv.source).icon}
                    </div>
                    <div className="conv-info">
                      <h3 className="conv-title">{conv.title || "Untitled"}</h3>
                      <div className="conv-meta">
                        <span className="conv-time">{getRelativeTime(conv.updated_at || conv.created_at)}</span>
                        <span className="conv-stats">
                          {conv.message_count} message{conv.message_count !== 1 ? 's' : ''}
                        </span>
                        {conv.word_count && (
                          <span className="conv-stats">{estimateReadingTime(conv.word_count)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="card-right">
                    <span className="tag source" data-source={conv.source}>
                      {getSourceInfo(conv.source).name}
                    </span>
                  </div>
                </div>
                <div className="card-preview">
                  <p className="conv-preview">{getMessagePreview(conv)}</p>
                </div>
                {extractTags(conv.title).length > 0 && (
                  <div className="card-tags">
                    {extractTags(conv.title).map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {!sidebarCollapsed && totalPages > 1 && (
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={loading || currentPage <= 1}
            >
              Prev
            </button>
            <span className="pagination-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={loading || currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        )}
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
                  <button className="menu-item" onClick={handleExportMarkdown}>
                    <Download size={16} />
                    Export as Markdown
                  </button>
                  <button className="menu-item" onClick={handleExportJson}>
                    <Download size={16} />
                    Export as JSON
                  </button>
                  <button className="menu-item" onClick={handleExportPdf}>
                    <Download size={16} />
                    Export as PDF
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
              {getOrderedMessages(selectedConversation).map((msg, index) => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className="message-header">
                    <div className="message-avatar">
                      {msg.role === "user" ? (
                        <div className="user-avatar">👤</div>
                      ) : (
                        <div className="assistant-avatar" data-source={selectedConversation.source}>
                          {getSourceInfo(selectedConversation.source).icon}
                        </div>
                      )}
                    </div>
                    <div className="message-meta">
                      <div className="message-role">
                        {msg.role === "user" ? "You" : getSourceInfo(selectedConversation.source).name}
                      </div>
                      <div className="message-time">
                        {formatDateTime(msg.created_at)}
                        {index < selectedConversation.messages.length - 1 && (
                          <span className="message-number">Message {index + 1}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="message-content markdown-content">
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} onSuccess={() => refreshConversationList()} />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      {showDuplicatesModal && (
        <DuplicatesModal
          onClose={() => setShowDuplicatesModal(false)}
          onSuccess={() => refreshConversationList()}
        />
      )}
    </div>
  );
}

function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'chatgpt' | 'claude' | 'gemini' | 'copilot'>('chatgpt');
  const [settings, setSettings] = useState<ImportSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/settings/import`);
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const sourceInfo = {
    chatgpt: {
      name: 'ChatGPT',
      description: 'OpenAI ChatGPT conversations.json export',
      icon: '💬',
    },
    claude: {
      name: 'Claude',
      description: 'Anthropic Claude conversation export',
      icon: '🤖',
    },
    gemini: {
      name: 'Gemini',
      description: 'Google Gemini/Bard conversation export',
      icon: '✨',
    },
    copilot: {
      name: 'GitHub Copilot',
      description: 'GitHub Copilot Chat conversation export',
      icon: '👨‍💻',
    },
  };

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
      const response = await fetch(`${API_URL}/import/${source}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Import failed");
      }

      const data = await response.json();
      const countMsg = data.length === 1 ? "1 conversation" : `${data.length} conversations`;
      const dupeMsg = settings?.auto_merge_duplicates ? " (duplicates skipped)" : "";
      setStatus(`Imported ${countMsg} from ${sourceInfo[source].name}!${dupeMsg}`);
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
      <div className="modal import-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Import Conversations</h2>
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

          <div className="form-group">
            <label htmlFor="file-input">Select File</label>
            <input
              id="file-input"
              type="file"
              accept="application/json"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="file-input"
            />
            {file && <p className="file-name">📄 {file.name}</p>}
          </div>

          {settings?.auto_merge_duplicates && (
            <div className="import-info">
              ℹ️ Auto-merge duplicates is enabled. Existing conversations will be skipped.
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={!file}>
              Import from {sourceInfo[source].name}
            </button>
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

function DuplicatesModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [duplicates, setDuplicates] = useState<DuplicatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [strategy, setStrategy] = useState<'source_id' | 'title' | 'both'>('source_id');
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const getSourceInfo = (source: string) => {
    const sources: Record<string, { icon: string; name: string }> = {
      chatgpt: { icon: '💬', name: 'ChatGPT' },
      claude: { icon: '🤖', name: 'Claude' },
      gemini: { icon: '✨', name: 'Gemini' },
      copilot: { icon: '👨‍💻', name: 'Copilot' },
    };
    return sources[source] || { icon: '📝', name: source };
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    loadDuplicates();
  }, [strategy]);

  const loadDuplicates = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/conversations/duplicates?strategy=${strategy}`);
      const data = await response.json();
      setDuplicates(data);
    } catch (error) {
      console.error("Failed to load duplicates:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupExpanded = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleSelection = (convId: number) => {
    const newSelected = new Set(selectedForDeletion);
    if (newSelected.has(convId)) {
      newSelected.delete(convId);
    } else {
      newSelected.add(convId);
    }
    setSelectedForDeletion(newSelected);
  };

  const selectAllInGroup = (group: DuplicateGroup) => {
    const newSelected = new Set(selectedForDeletion);
    group.conversations.forEach(conv => newSelected.add(conv.id));
    setSelectedForDeletion(newSelected);
  };

  const keepNewestInGroup = (group: DuplicateGroup) => {
    const sorted = [...group.conversations].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    const newSelected = new Set(selectedForDeletion);
    sorted.slice(1).forEach(conv => newSelected.add(conv.id));
    setSelectedForDeletion(newSelected);
  };

  const keepOldestInGroup = (group: DuplicateGroup) => {
    const sorted = [...group.conversations].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });

    const newSelected = new Set(selectedForDeletion);
    sorted.slice(1).forEach(conv => newSelected.add(conv.id));
    setSelectedForDeletion(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedForDeletion.size === 0) {
      alert("Please select conversations to delete");
      return;
    }

    const message = `Delete ${selectedForDeletion.size} conversation(s)? This cannot be undone.`;
    if (!confirm(message)) return;

    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/conversations/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_ids: Array.from(selectedForDeletion)
        })
      });

      if (!response.ok) {
        throw new Error("Failed to delete conversations");
      }

      const result = await response.json();
      alert(`Successfully deleted ${result.deleted_count} conversation(s)`);

      setSelectedForDeletion(new Set());
      await loadDuplicates();
      onSuccess();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete conversations");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal duplicates-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Find Duplicate Conversations</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="strategy-selector">
          <label>Detection Method:</label>
          <select value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)}>
            <option value="source_id">By Source ID (original conversation ID)</option>
            <option value="title">By Title (exact match)</option>
            <option value="both">Both Methods (comprehensive)</option>
          </select>
        </div>

        {!loading && duplicates && (
          <div className="duplicates-summary">
            <div className="stat">
              <span className="label">Duplicate Groups:</span>
              <span className="value">{duplicates.total_groups}</span>
            </div>
            <div className="stat">
              <span className="label">Total Duplicates:</span>
              <span className="value">{duplicates.total_duplicates}</span>
            </div>
            <div className="stat">
              <span className="label">Selected for Deletion:</span>
              <span className="value">{selectedForDeletion.size}</span>
            </div>
          </div>
        )}

        <div className="duplicates-content">
          {loading ? (
            <div className="loading">Loading duplicates...</div>
          ) : !duplicates || duplicates.groups.length === 0 ? (
            <div className="empty">
              <p>No duplicate conversations found!</p>
              <small>Try a different detection method or import more conversations.</small>
            </div>
          ) : (
            <div className="duplicate-groups">
              {duplicates.groups.map((group) => (
                <div key={group.key} className="duplicate-group">
                  <div className="group-header" onClick={() => toggleGroupExpanded(group.key)}>
                    <div className="group-info">
                      <h3>
                        {getSourceInfo(group.source).icon} {group.title || "Untitled"}
                      </h3>
                      <div className="group-meta">
                        <span>{group.count} duplicates</span>
                        <span>•</span>
                        <span>{group.total_messages} total messages</span>
                        {group.source_id && (
                          <>
                            <span>•</span>
                            <span>ID: {group.source_id.slice(0, 8)}...</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button className="expand-btn">
                      {expandedGroups.has(group.key) ? "▼" : "▶"}
                    </button>
                  </div>

                  {expandedGroups.has(group.key) && (
                    <div className="group-content">
                      <div className="group-actions">
                        <button onClick={() => keepNewestInGroup(group)}>
                          Keep Newest
                        </button>
                        <button onClick={() => keepOldestInGroup(group)}>
                          Keep Oldest
                        </button>
                        <button onClick={() => selectAllInGroup(group)}>
                          Select All
                        </button>
                      </div>

                      <div className="conversations-list">
                        {group.conversations.map((conv) => (
                          <div key={conv.id} className="duplicate-conversation">
                            <input
                              type="checkbox"
                              checked={selectedForDeletion.has(conv.id)}
                              onChange={() => toggleSelection(conv.id)}
                            />
                            <div className="conv-info">
                              <div className="conv-title">
                                {conv.title || "Untitled"}
                              </div>
                              <div className="conv-details">
                                <span>ID: {conv.id}</span>
                                <span>•</span>
                                <span>{conv.message_count} messages</span>
                                {conv.created_at && (
                                  <>
                                    <span>•</span>
                                    <span>{formatDateTime(conv.created_at)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="danger"
            onClick={handleBulkDelete}
            disabled={selectedForDeletion.size === 0 || deleting}
          >
            {deleting ? "Deleting..." : `Delete Selected (${selectedForDeletion.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
