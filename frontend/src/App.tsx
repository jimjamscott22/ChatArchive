import React, { useState, useEffect } from "react";
import { Sparkles, Upload, Search, Menu, Sun, Moon, MoreVertical, Trash2, Download, Tag, Settings, Copy, Database, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Maximize2, Minimize2, BarChart2 } from "lucide-react";
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
  tags?: TagType[];
  project?: ProjectType | null;
};

type TagType = {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at: string;
  conversation_count: number;
};

type ProjectType = {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at: string;
  conversation_count: number;
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

type AnalyticsData = {
  total_conversations: number;
  total_messages: number;
  avg_messages_per_conversation: number;
  sources: Record<string, number>;
  conversations_by_month: { month: string; count: number }[];
  role_distribution: Record<string, number>;
  activity_by_day: Record<string, number>;
  top_tags: { name: string; color: string; count: number }[];
  projects: { name: string; color: string; count: number }[];
};

type DuplicatesData = {
  groups: DuplicateGroup[];
  total_duplicates: number;
  total_groups: number;
  strategy: string;
};

// Check if we're in standalone conversation view (opened in new window)
function getInitialConversationId(): number | null {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("conversation");
  return id ? parseInt(id, 10) : null;
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [standaloneMode, setStandaloneMode] = useState(() => getInitialConversationId() !== null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showMenu, setShowMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedConversationIndex, setSelectedConversationIndex] = useState<number>(-1);
  const [showStats, setShowStats] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [allProjects, setAllProjects] = useState<ProjectType[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showMoveToProjectModal, setShowMoveToProjectModal] = useState(false);
  const [supabaseDashboardUrl, setSupabaseDashboardUrl] = useState<string | null>(null);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [conversationListCollapsed, setConversationListCollapsed] = useState(false);
  const [fullWidthConvo, setFullWidthConvo] = useState(false);
  const [draggedConversationId, setDraggedConversationId] = useState<number | null>(null);
  const [dragOverProject, setDragOverProject] = useState<number | 'uncategorized' | null>(null);

  // Load conversations on mount
  useEffect(() => {
    refreshConversationList(1);
    loadTags();
    loadProjects();
    checkSupabaseConfiguration();
  }, []);

  // When in standalone mode (opened via ?conversation=id), load that conversation
  useEffect(() => {
    const convId = getInitialConversationId();
    if (convId && standaloneMode) {
      loadConversation(convId);
    }
  }, [standaloneMode]);

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
        setShowAnalyticsModal(false);
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

  const loadConversations = async (source?: string, page = 1, tag?: string | null, projectId?: number | null) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page_size: PAGE_SIZE.toString(),
        page: page.toString(),
      });
      if (source && source !== "all") {
        params.append("source", source);
      }
      if (tag) {
        params.append("tag", tag);
      }
      if (projectId !== null && projectId !== undefined) {
        params.append("project_id", projectId.toString());
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

  const refreshConversationList = (page = currentPage, source?: string, tag?: string | null, projectId?: number | null) => {
    const nextSource = source ?? sourceFilter;
    const nextTag = tag ?? selectedTag;
    const nextProject = projectId !== undefined ? projectId : selectedProject;
    if (searchQuery.trim()) {
      loadSearchResults(searchQuery.trim(), page, nextSource);
      return;
    }
    loadConversations(nextSource, page, nextTag, nextProject);
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

  const openConversationInNewWindow = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?conversation=${id}`;
    window.open(url, "_blank", "noopener,noreferrer,width=900,height=700");
  };

  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    if (!query.trim()) {
      loadConversations(sourceFilter, 1, selectedTag, selectedProject);
      return;
    }

    await loadSearchResults(query.trim(), 1, sourceFilter);
  };

  // Tag-related functions
  const loadTags = async () => {
    try {
      const response = await fetch(`${API_URL}/tags`);
      const data = await response.json();
      const tags = data.items || [];
      setAllTags(tags);
      if (selectedTag && !tags.some((tag: TagType) => tag.name === selectedTag)) {
        setSelectedTag(null);
      }
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  };

  const loadProjects = async () => {
    try {
      const response = await fetch(`${API_URL}/projects`);
      const data = await response.json();
      const projects = data.items || [];
      setAllProjects(projects);
      if (selectedProject && !projects.some((proj: ProjectType) => proj.id === selectedProject)) {
        setSelectedProject(null);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  };

  const handleTagFilter = (tagName: string | null) => {
    setSelectedTag(tagName);
    setCurrentPage(1);
    loadConversations(sourceFilter, 1, tagName);
  };

  const handleProjectFilter = (projectId: number | null) => {
    setSelectedProject(projectId);
    setSelectedTag(null); // Clear tag filter when selecting project
    setCurrentPage(1);
    refreshConversationList(1, undefined, null, projectId);
  };

  const checkSupabaseConfiguration = async () => {
    try {
      const response = await fetch(`${API_URL}/settings/supabase-dashboard-url`);
      if (response.ok) {
        const data = await response.json();
        setSupabaseDashboardUrl(data.dashboard_url);
        setSupabaseConfigured(data.configured);
      } else {
        setSupabaseConfigured(false);
        setSupabaseDashboardUrl(null);
      }
    } catch (error) {
      console.error("Failed to check Supabase configuration:", error);
      setSupabaseConfigured(false);
      setSupabaseDashboardUrl(null);
    }
  };

  const autoTagAllConversations = async () => {
    try {
      setAutoTagging(true);
      const response = await fetch(`${API_URL}/conversations/auto-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwrite_existing: false }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to auto-tag conversations');
      }
      
      const result = await response.json();
      console.log('Auto-tagging result:', result);
      
      // Reload conversations and tags
      await loadTags();
      refreshConversationList(currentPage);
      
      alert(`Successfully tagged ${result.tagged_count} conversations!`);
    } catch (error) {
      console.error("Failed to auto-tag conversations:", error);
      alert("Failed to auto-tag conversations. Please try again.");
    } finally {
      setAutoTagging(false);
    }
  };

  const removeTagFromConversation = async (conversationId: number, tagId: number) => {
    try {
      const response = await fetch(`${API_URL}/conversations/${conversationId}/tags/${tagId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove tag');
      }
      
      // Reload the conversation to get updated tags
      if (selectedConversation?.id === conversationId) {
        await loadConversation(conversationId);
      }
      
      // Refresh the conversation list
      refreshConversationList(currentPage);
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  };

  const createProject = async (name: string, description: string, color: string) => {
    try {
      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, color }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create project');
      }
      
      await loadProjects();
      return true;
    } catch (error) {
      console.error("Failed to create project:", error);
      alert(error instanceof Error ? error.message : 'Failed to create project');
      return false;
    }
  };

  const moveConversationToProject = async (conversationId: number, projectId: number | null) => {
    try {
      const response = await fetch(`${API_URL}/conversations/${conversationId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to move conversation');
      }
      
      // Reload the conversation to get updated project
      if (selectedConversation?.id === conversationId) {
        await loadConversation(conversationId);
      }
      
      // Refresh the conversation list and projects
      await loadProjects();
      refreshConversationList(currentPage);
      setShowMoveToProjectModal(false);
    } catch (error) {
      console.error("Failed to move conversation:", error);
      alert('Failed to move conversation to project');
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
    loadConversations(source, 1, null, null);
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

  const escapeRegExp = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const renderHighlightedText = (text: string, query: string): React.ReactNode => {
    const trimmed = query.trim();
    if (!trimmed) return text;
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return text;
    const escapedTokens = tokens.map(escapeRegExp);
    const regex = new RegExp(`(${escapedTokens.join("|")})`, "gi");
    const lowerTokens = new Set(tokens.map((token) => token.toLowerCase()));
    return text.split(regex).map((part, index) => {
      if (lowerTokens.has(part.toLowerCase())) {
        return (
          <mark key={`${part}-${index}`} className="search-highlight">
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  const applyHighlightToNode = (node: React.ReactNode, query: string): React.ReactNode => {
    const trimmed = query.trim();
    if (!trimmed) return node;
    if (typeof node === "string") {
      return renderHighlightedText(node, trimmed);
    }
    if (Array.isArray(node)) {
      return node.map((child, index) => (
        <React.Fragment key={index}>{applyHighlightToNode(child, trimmed)}</React.Fragment>
      ));
    }
    if (React.isValidElement(node)) {
      const elementType = typeof node.type === "string" ? node.type : "";
      if (elementType === "code" || elementType === "pre") {
        return node;
      }
      const children = node.props?.children;
      if (!children) return node;
      return React.cloneElement(node, {
        ...node.props,
        children: applyHighlightToNode(children, trimmed),
      });
    }
    return node;
  };

  const getHighlightMarkdownComponents = (query: string) => {
    const withHighlight =
      (Tag: keyof JSX.IntrinsicElements) =>
      ({ children, ...props }: any) =>
        (
          <Tag {...props}>{applyHighlightToNode(children, query)}</Tag>
        );
    return {
      p: withHighlight("p"),
      li: withHighlight("li"),
      h1: withHighlight("h1"),
      h2: withHighlight("h2"),
      h3: withHighlight("h3"),
      h4: withHighlight("h4"),
      h5: withHighlight("h5"),
      h6: withHighlight("h6"),
      blockquote: withHighlight("blockquote"),
      strong: withHighlight("strong"),
      em: withHighlight("em"),
      a: withHighlight("a"),
      span: withHighlight("span"),
    };
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

  const highlightQuery = searchQuery.trim();
  const markdownComponents = highlightQuery ? getHighlightMarkdownComponents(highlightQuery) : undefined;

  // Standalone mode: show only the conversation (opened in new window)
  if (standaloneMode) {
    return (
      <div className="app-container standalone-view">
        <div className="standalone-header">
          <h1 className="standalone-title">{selectedConversation?.title || "Loading..."}</h1>
          <a
            href={window.location.pathname}
            target="_self"
            className="icon-btn back-link"
            title="Back to ChatArchive"
          >
            ← Back to ChatArchive
          </a>
        </div>
        <div className="standalone-content">
          {selectedConversation ? (
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
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="welcome-state">
              <p>Loading conversation...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container${fullWidthConvo && selectedConversation ? ' sidebar-hidden' : ''}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <Sparkles size={20} />
            {!sidebarCollapsed && <span>ChatArchive</span>}
          </div>
          <div className="header-buttons">
            {!sidebarCollapsed && supabaseConfigured && supabaseDashboardUrl && (
              <a
                href={supabaseDashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="icon-btn supabase-link"
                title="Open Supabase Dashboard"
              >
                <Database size={18} />
              </a>
            )}
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

        <button className="duplicates-btn" onClick={() => setShowDuplicatesModal(true)}>
          <Copy size={16} />
          Find Duplicates
        </button>

        <button className="analytics-btn" onClick={() => setShowAnalyticsModal(true)}>
          <BarChart2 size={16} />
          Analytics
        </button>

        <button
          className="auto-tag-btn"
          onClick={autoTagAllConversations}
          disabled={autoTagging}
          title="Automatically tag all conversations based on content"
        >
          <Tag size={16} />
          {autoTagging ? 'Auto-Tagging...' : 'Auto-Tag All'}
        </button>

        {!sidebarCollapsed && (
          <div className="sidebar-filters">
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

            <div className="tag-filter">
              <label>Filter by tag:</label>
              <select 
                value={selectedTag || 'all'} 
                onChange={(e) => handleTagFilter(e.target.value === 'all' ? null : e.target.value)}
              >
                <option value="all">All Tags</option>
                {allTags.map((tag) => (
                  <option key={tag.id} value={tag.name}>
                    {tag.name} ({tag.conversation_count})
                  </option>
                ))}
              </select>
            </div>

            <div className="project-filter">
              <label>Filter by project:</label>
              <select 
                value={selectedProject !== null ? selectedProject.toString() : 'all'} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all') {
                    handleProjectFilter(null);
                  } else if (val === '-1') {
                    handleProjectFilter(-1);
                  } else {
                    handleProjectFilter(parseInt(val));
                  }
                }}
              >
                <option value="all">All Projects</option>
                <option value="-1">📂 Uncategorized ({conversations.filter(c => !c.project).length})</option>
                {allProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    📁 {project.name} ({project.conversation_count})
                  </option>
                ))}
              </select>
            </div>

            {allProjects.length > 0 && (
              <div className={`project-drop-zones ${draggedConversationId ? 'drag-mode' : ''}`}>
                <label>Projects — drag here to assign</label>
                <div
                  className={`project-drop-zone${dragOverProject === 'uncategorized' ? ' drag-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverProject('uncategorized'); }}
                  onDragLeave={() => setDragOverProject(null)}
                  onDrop={async () => {
                    if (draggedConversationId !== null) {
                      await moveConversationToProject(draggedConversationId, null);
                    }
                    setDragOverProject(null);
                    setDraggedConversationId(null);
                  }}
                  onClick={() => handleProjectFilter(-1)}
                  title="Uncategorized conversations"
                >
                  📂 Uncategorized
                </div>
                {allProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`project-drop-zone${dragOverProject === project.id ? ' drag-over' : ''}`}
                    style={{ borderLeftColor: project.color || '#8B5CF6' }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverProject(project.id); }}
                    onDragLeave={() => setDragOverProject(null)}
                    onDrop={async () => {
                      if (draggedConversationId !== null) {
                        await moveConversationToProject(draggedConversationId, project.id);
                      }
                      setDragOverProject(null);
                      setDraggedConversationId(null);
                    }}
                    onClick={() => handleProjectFilter(project.id)}
                    title={project.description || project.name}
                  >
                    <span className="project-drop-color-dot" style={{ backgroundColor: project.color || '#8B5CF6' }} />
                    {project.name}
                  </div>
                ))}
              </div>
            )}

            <button className="manage-tags-btn" onClick={() => setShowTagModal(true)}>
              <Tag size={16} />
              Manage Tags
            </button>

            <button className="manage-projects-btn" onClick={() => setShowProjectModal(true)}>
              <Settings size={16} />
              Manage Projects
            </button>

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
          </div>
        )}

        <div className="conversations-list sidebar-list" aria-label="Conversation list in sidebar">
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
              <p>Import your first conversation to get started</p>
              <button className="empty-action-btn" onClick={() => setShowImportModal(true)}>
                <Upload size={16} />
                Import Conversations
              </button>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-card ${selectedConversation?.id === conv.id ? "active" : ""} ${draggedConversationId === conv.id ? "dragging" : ""}`}
                onClick={() => loadConversation(conv.id)}
                draggable={true}
                onDragStart={(e) => {
                  setDraggedConversationId(conv.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(conv.id));
                }}
                onDragEnd={() => {
                  setDraggedConversationId(null);
                  setDragOverProject(null);
                }}
              >
                <div className="card-header">
                  <div className="card-left">
                    <div className="source-avatar" data-source={conv.source}>
                      {getSourceInfo(conv.source).icon}
                    </div>
                    <div className="conv-info">
                      <h3 className="conv-title">
                        {renderHighlightedText(conv.title || "Untitled", highlightQuery)}
                      </h3>
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
                    <button
                      className="icon-btn open-new-window-btn"
                      title="Open in new window"
                      onClick={(e) => openConversationInNewWindow(conv.id, e)}
                    >
                      <ExternalLink size={16} />
                    </button>
                    <span className="tag source" data-source={conv.source}>
                      {getSourceInfo(conv.source).name}
                    </span>
                  </div>
                </div>
                <div className="card-preview">
                  <p className="conv-preview">
                    {renderHighlightedText(getMessagePreview(conv), highlightQuery)}
                  </p>
                </div>
                {conv.tags && conv.tags.length > 0 && (
                  <div className="card-tags">
                    {conv.tags.map((tag) => (
                      <span 
                        key={tag.id} 
                        className="tag tag-badge" 
                        style={{
                          backgroundColor: tag.color || '#6B7280',
                          color: 'white',
                          cursor: 'pointer'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTagFilter(tag.name);
                        }}
                        title={tag.description || tag.name}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
                {conv.project && (
                  <div className="card-project">
                    <span 
                      className="project-badge" 
                      style={{
                        backgroundColor: conv.project.color || '#8B5CF6',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'inline-block',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProjectFilter(conv.project!.id);
                      }}
                      title={conv.project.description || conv.project.name}
                    >
                      📁 {conv.project.name}
                    </span>
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

        {/* Sidebar collapse handle */}
        <button
          className="sidebar-collapse-handle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <button className="icon-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title="Toggle sidebar">
            <Menu size={20} />
          </button>
          {selectedConversation && (
            <button
              className="icon-btn"
              onClick={() => setFullWidthConvo(!fullWidthConvo)}
              title={fullWidthConvo ? "Show sidebar" : "Full width view"}
            >
              {fullWidthConvo ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}
          <h2 className="header-title">
            {selectedConversation?.title || "Select a conversation"}
          </h2>
          {selectedConversation && selectedConversation.tags && selectedConversation.tags.length > 0 && (
            <div className="conversation-tags-header">
              {selectedConversation.tags.map((tag) => (
                <span 
                  key={tag.id} 
                  className="tag tag-badge"
                  style={{
                    backgroundColor: tag.color || '#6B7280',
                    color: 'white',
                  }}
                  title={tag.description || tag.name}
                >
                  {tag.name}
                  <button
                    className="tag-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Remove tag "${tag.name}" from this conversation?`)) {
                        removeTagFromConversation(selectedConversation.id, tag.id);
                      }
                    }}
                    style={{ marginLeft: '4px', cursor: 'pointer', border: 'none', background: 'transparent', color: 'white' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {selectedConversation && (
            <div className="header-actions">
              <button className="icon-btn" onClick={() => setShowMenu(!showMenu)} title="More options">
                <MoreVertical size={20} />
              </button>
              {showMenu && (
                <div className="dropdown-menu">
                  <button className="menu-item" onClick={() => { setShowMoveToProjectModal(true); setShowMenu(false); }}>
                    <Settings size={16} />
                    Move to project
                  </button>
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

        <div className="content-area content-area-scrollable">
          {!selectedConversation ? (
            <div className="center-conversations-wrapper">
              <div
                className="center-conversations-header collapsible-header"
                onClick={() => setConversationListCollapsed(!conversationListCollapsed)}
                title={conversationListCollapsed ? "Expand conversation list" : "Collapse conversation list"}
              >
                <div className="center-header-left">
                  <h2>Your conversations</h2>
                  {!conversationListCollapsed && (
                    <p className="center-subtitle">
                      Click any conversation to open it in a new window, or select from the sidebar to preview here
                    </p>
                  )}
                </div>
                <button className="icon-btn collapse-list-btn" tabIndex={-1}>
                  {conversationListCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                </button>
              </div>
              {!conversationListCollapsed && (
                <>
                  {(loading || isSearching) ? (
                    <div className="skeleton-container center-skeleton">
                      {Array.from({ length: 8 }).map((_, i) => (
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
                    <div className="welcome-state">
                      <Sparkles size={48} className="welcome-icon" />
                      <h2>Welcome to ChatArchive</h2>
                      <p>Import your chat history to get started</p>
                      <button className="empty-action-btn" onClick={() => setShowImportModal(true)}>
                        <Upload size={16} />
                        Import Conversations
                      </button>
                    </div>
                  ) : (
                    <div className="center-conversations-list">
                      {(conversations as Conversation[]).map((conv: Conversation) => (
                        <div
                          key={conv.id}
                          className="conversation-card center-card"
                          onClick={() => loadConversation(conv.id)}
                        >
                          <div className="card-header">
                            <div className="card-left">
                              <div className="source-avatar" data-source={conv.source}>
                                {getSourceInfo(conv.source).icon}
                              </div>
                              <div className="conv-info">
                                <h3 className="conv-title">
                                  {renderHighlightedText(conv.title || "Untitled", highlightQuery)}
                                </h3>
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
                              <button
                                className="icon-btn open-new-window-btn primary-action"
                                title="Open in new window"
                                onClick={(e) => openConversationInNewWindow(conv.id, e)}
                              >
                                <ExternalLink size={16} />
                                Open in new window
                              </button>
                              <span className="tag source" data-source={conv.source}>
                                {getSourceInfo(conv.source).name}
                              </span>
                            </div>
                          </div>
                          <div className="card-preview">
                            <p className="conv-preview">
                              {renderHighlightedText(getMessagePreview(conv), highlightQuery)}
                            </p>
                          </div>
                          {conv.tags && conv.tags.length > 0 && (
                            <div className="card-tags">
                              {conv.tags.map((tag: TagType) => (
                                <span
                                  key={tag.id}
                                  className="tag tag-badge"
                                  style={{
                                    backgroundColor: tag.color || '#6B7280',
                                    color: 'white',
                                    cursor: 'pointer'
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTagFilter(tag.name);
                                  }}
                                  title={tag.description || tag.name}
                                >
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!loading && !isSearching && conversations.length > 0 && totalPages > 1 && (
                    <div className="center-pagination">
                      <button
                        className="pagination-btn"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                      >
                        ← Prev
                      </button>
                      <span className="pagination-info">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        className="pagination-btn"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
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
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
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

      {showTagModal && (
        <TagManagerModal
          tags={allTags}
          onClose={() => setShowTagModal(false)}
          onTagsUpdated={loadTags}
        />
      )}

      {showProjectModal && (
        <ProjectManagerModal
          projects={allProjects}
          onClose={() => setShowProjectModal(false)}
          onProjectsUpdated={loadProjects}
        />
      )}

      {showMoveToProjectModal && selectedConversation && (
        <MoveToProjectModal
          conversation={selectedConversation}
          projects={allProjects}
          onClose={() => setShowMoveToProjectModal(false)}
          onMove={moveConversationToProject}
        />
      )}

      {showAnalyticsModal && (
        <AnalyticsDashboard onClose={() => setShowAnalyticsModal(false)} />
      )}
    </div>
  );
}

function TagManagerModal({
  tags,
  onClose,
  onTagsUpdated,
}: {
  tags: TagType[];
  onClose: () => void;
  onTagsUpdated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor("#3B82F6");
    setEditingTag(null);
    setError(null);
  };

  const handleEdit = (tag: TagType) => {
    setEditingTag(tag);
    setName(tag.name);
    setDescription(tag.description || "");
    setColor(tag.color || "#3B82F6");
    setStatus(null);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Tag name is required.");
      return;
    }

    const payload = {
      name: trimmedName,
      description: description.trim() || null,
      color: color.trim() || null,
    };

    setSaving(true);
    try {
      const response = await fetch(
        editingTag ? `${API_URL}/tags/${editingTag.id}` : `${API_URL}/tags`,
        {
          method: editingTag ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to save tag.");
      }

      await onTagsUpdated();
      resetForm();
      setStatus(editingTag ? "Tag updated." : "Tag created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tag.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: TagType) => {
    const message = `Delete tag "${tag.name}"? This will remove it from all conversations.`;
    if (!confirm(message)) return;

    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/tags/${tag.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete tag.");
      }
      await onTagsUpdated();
      if (editingTag?.id === tag.id) {
        resetForm();
      }
      setStatus("Tag deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tag.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal tag-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Tags</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="tag-manager-content">
          <form className="tag-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Tag name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. research"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="form-group">
              <label>Color</label>
              <div className="tag-color-row">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  aria-label="Tag color"
                />
                <span className="tag-preview" style={{ backgroundColor: color }}>
                  {name.trim() || "Preview"}
                </span>
              </div>
            </div>

            <div className="tag-form-actions">
              {editingTag && (
                <button type="button" onClick={resetForm}>
                  Cancel Edit
                </button>
              )}
              <button className="primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : editingTag ? "Save Tag" : "Create Tag"}
              </button>
            </div>

            {status && <div className="status-success">{status}</div>}
            {error && <div className="status-error">{error}</div>}
          </form>

          <div className="tag-list">
            <div className="tag-list-header">Existing tags</div>
            {tags.length === 0 ? (
              <div className="empty">No tags created yet.</div>
            ) : (
              <div className="tag-list-items">
                {tags.map((tag) => (
                  <div key={tag.id} className="tag-row">
                    <div className="tag-row-main">
                      <span className="tag-badge" style={{ backgroundColor: tag.color || "#6B7280", color: "white" }}>
                        {tag.name}
                      </span>
                      <div className="tag-row-info">
                        <div className="tag-row-name">{tag.name}</div>
                        <div className="tag-row-meta">
                          {tag.description || "No description"}
                        </div>
                      </div>
                    </div>
                    <div className="tag-row-actions">
                      <span className="tag-count">{tag.conversation_count} conv</span>
                      <button type="button" onClick={() => handleEdit(tag)}>
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => handleDelete(tag)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
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
      description: 'OpenAI ChatGPT conversations.json export',
      icon: '💬',
      exportUrl: 'https://chatgpt.com/#settings/DataControls',
      exportSteps: [
        'Go to ChatGPT Settings → Data Controls → Export Data',
        'Click "Export" and wait for the email confirmation',
        'Download the archive and extract conversations.json',
      ],
    },
    claude: {
      name: 'Claude',
      description: 'Anthropic Claude conversation export',
      icon: '🤖',
      exportUrl: 'https://claude.ai/settings',
      exportSteps: [
        'Visit claude.ai/settings',
        'Navigate to "Data & Privacy"',
        'Click "Request your data export"',
        'Wait for the email with your export (may take a few hours)',
        'Download and extract the JSON file',
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

  const handleDeleteImport = async (historyId: number) => {
    const message = "Delete this import and all its conversations? This cannot be undone.";
    if (!confirm(message)) return;
    
    try {
      const response = await fetch(`${API_URL}/import/history/${historyId}?delete_conversations=true`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete import");
      }
      
      const result = await response.json();
      alert(`Deleted import and ${result.deleted_conversations} conversation(s)`);
      
      // Refresh history list
      await loadHistory();
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

      // Update local state instead of re-querying
      setDuplicates(prev => {
        if (!prev) return prev;
        const updatedGroups = prev.groups
          .map(group => ({
            ...group,
            conversations: group.conversations.filter(c => !selectedForDeletion.has(c.id)),
            count: group.conversations.filter(c => !selectedForDeletion.has(c.id)).length,
            total_messages: group.conversations
              .filter(c => !selectedForDeletion.has(c.id))
              .reduce((sum, c) => sum + c.message_count, 0),
          }))
          .filter(group => group.conversations.length > 1);
        return {
          ...prev,
          groups: updatedGroups,
          total_groups: updatedGroups.length,
          total_duplicates: updatedGroups.reduce((sum, g) => sum + g.count, 0),
        };
      });
      setSelectedForDeletion(new Set());
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

function ProjectManagerModal({
  projects,
  onClose,
  onProjectsUpdated,
}: {
  projects: ProjectType[];
  onClose: () => void;
  onProjectsUpdated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#8B5CF6");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor("#8B5CF6");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Project name is required.");
      return;
    }

    const payload = {
      name: trimmedName,
      description: description.trim() || null,
      color: color.trim() || null,
    };

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create project.");
      }

      await onProjectsUpdated();
      resetForm();
      setStatus("Project created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (project: ProjectType) => {
    const message = `Delete project "${project.name}"? Conversations will become uncategorized.`;
    if (!confirm(message)) return;

    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/projects/${project.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete project.");
      }
      await onProjectsUpdated();
      setStatus("Project deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content tag-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Projects</h2>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit} className="tag-form">
            <h3>Create New Project</h3>
            <input
              type="text"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              required
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
            />
            <div className="color-picker">
              <label>Color:</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={saving}
              />
            </div>
            <button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create Project"}
            </button>
            {status && <div className="status-message success">{status}</div>}
            {error && <div className="status-message error">{error}</div>}
          </form>

          <div className="existing-tags">
            <h3>Existing Projects ({projects.length})</h3>
            {projects.length === 0 ? (
              <p className="empty-message">No projects yet. Create one above!</p>
            ) : (
              <div className="tag-list">
                {projects.map((project) => (
                  <div key={project.id} className="tag-item">
                    <div className="tag-info">
                      <span
                        className="tag-color"
                        style={{ backgroundColor: project.color || "#8B5CF6" }}
                      ></span>
                      <div className="tag-details">
                        <strong>{project.name}</strong>
                        {project.description && <p>{project.description}</p>}
                        <small>{project.conversation_count} conversations</small>
                      </div>
                    </div>
                    <div className="tag-actions">
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(project)}
                        disabled={saving}
                        title="Delete project"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsDashboard({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/analytics`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const SOURCE_COLORS: Record<string, string> = {
    chatgpt: "#10B981",
    claude: "#F59E0B",
    gemini: "#3B82F6",
    copilot: "#8B5CF6",
  };

  const ROLE_COLORS: Record<string, string> = {
    user: "#3B82F6",
    assistant: "#10B981",
    system: "#F59E0B",
    tool: "#EC4899",
  };

  function HorizontalBar({ label, value, max, color, count }: {
    label: string; value: number; max: number; color: string; count: number;
  }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{label}</span>
          <span style={{ color: "var(--text-secondary)" }}>{count.toLocaleString()}</span>
        </div>
        <div style={{ height: 8, background: "var(--bg-tertiary)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.4s ease" }} />
        </div>
      </div>
    );
  }

  function TimelineChart({ months }: { months: { month: string; count: number }[] }) {
    if (months.length === 0) return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No data yet.</p>;
    const maxCount = Math.max(...months.map((m) => m.count), 1);
    const chartH = 120;
    const barW = Math.max(16, Math.min(40, Math.floor(560 / months.length) - 4));
    const gap = 4;
    const totalW = months.length * (barW + gap);

    return (
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <svg width={Math.max(totalW, 200)} height={chartH + 36} style={{ display: "block" }}>
          {months.map((m, i) => {
            const barH = Math.max(2, (m.count / maxCount) * chartH);
            const x = i * (barW + gap);
            const labelYear = m.month.slice(0, 4);
            const labelMon = m.month.slice(5, 7);
            const isJan = labelMon === "01";
            return (
              <g key={m.month}>
                <rect
                  x={x}
                  y={chartH - barH}
                  width={barW}
                  height={barH}
                  fill="#3B82F6"
                  rx={3}
                  opacity={0.85}
                >
                  <title>{m.month}: {m.count}</title>
                </rect>
                {(isJan || months.length <= 18) && (
                  <text
                    x={x + barW / 2}
                    y={chartH + 16}
                    textAnchor="middle"
                    fontSize={9}
                    fill="var(--text-muted)"
                  >
                    {isJan ? labelYear : labelMon}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  function DayChart({ activityByDay }: { activityByDay: Record<string, number> }) {
    const values = DAY_NAMES.map((_, i) => activityByDay[String(i)] || 0);
    const max = Math.max(...values, 1);
    const chartH = 80;
    const barW = 32;
    const gap = 6;

    return (
      <svg width={DAY_NAMES.length * (barW + gap)} height={chartH + 28} style={{ display: "block" }}>
        {DAY_NAMES.map((name, i) => {
          const barH = Math.max(2, (values[i] / max) * chartH);
          const x = i * (barW + gap);
          return (
            <g key={name}>
              <rect x={x} y={chartH - barH} width={barW} height={barH} fill="#8B5CF6" rx={3} opacity={0.85}>
                <title>{name}: {values[i]}</title>
              </rect>
              <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
                {name}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)",
    zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center",
    overflowY: "auto", padding: "24px 16px",
  };

  const panelStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border-color)",
    borderRadius: 16, width: "100%", maxWidth: 860, padding: 32,
    boxShadow: "0 16px 48px rgba(0,0,0,0.4)", position: "relative",
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: 32,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 15, fontWeight: 600, color: "var(--text-primary)",
    marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid var(--border-color)",
  };

  const cardRowStyle: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32,
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-tertiary)", borderRadius: 12, padding: "20px 24px",
    border: "1px solid var(--border-color)",
  };

  const twoColStyle: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32,
  };

  return (
    <div className="modal-overlay" style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BarChart2 size={22} style={{ color: "#3B82F6" }} />
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
              Conversation Analytics
            </h2>
          </div>
          <button
            className="icon-btn"
            onClick={onClose}
            style={{ fontSize: 20, lineHeight: 1 }}
            title="Close"
          >
            ×
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-secondary)" }}>
            Loading analytics…
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#EF4444" }}>
            Failed to load analytics: {error}
          </div>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div style={cardRowStyle}>
              <div style={cardStyle}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#3B82F6" }}>
                  {data.total_conversations.toLocaleString()}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Total Conversations</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#10B981" }}>
                  {data.total_messages.toLocaleString()}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Total Messages</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#F59E0B" }}>
                  {data.avg_messages_per_conversation.toFixed(1)}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Avg Messages / Conv.</div>
              </div>
            </div>

            {/* Activity over time */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>Conversations Over Time</div>
              <TimelineChart months={data.conversations_by_month} />
            </div>

            <div style={twoColStyle}>
              {/* Source distribution */}
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>By Source</div>
                {Object.keys(data.sources).length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No data.</p>
                ) : (() => {
                  const maxSrc = Math.max(...Object.values(data.sources));
                  return Object.entries(data.sources)
                    .sort((a, b) => b[1] - a[1])
                    .map(([src, cnt]) => (
                      <HorizontalBar
                        key={src}
                        label={src.charAt(0).toUpperCase() + src.slice(1)}
                        value={cnt}
                        max={maxSrc}
                        color={SOURCE_COLORS[src] || "#6B7280"}
                        count={cnt}
                      />
                    ));
                })()}
              </div>

              {/* Role distribution */}
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Messages by Role</div>
                {Object.keys(data.role_distribution).length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No data.</p>
                ) : (() => {
                  const maxRole = Math.max(...Object.values(data.role_distribution));
                  return Object.entries(data.role_distribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([role, cnt]) => (
                      <HorizontalBar
                        key={role}
                        label={role.charAt(0).toUpperCase() + role.slice(1)}
                        value={cnt}
                        max={maxRole}
                        color={ROLE_COLORS[role] || "#6B7280"}
                        count={cnt}
                      />
                    ));
                })()}
              </div>
            </div>

            <div style={twoColStyle}>
              {/* Activity by day of week */}
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Activity by Day of Week</div>
                <DayChart activityByDay={data.activity_by_day} />
              </div>

              {/* Top tags */}
              {data.top_tags.length > 0 && (
                <div style={sectionStyle}>
                  <div style={sectionTitleStyle}>Top Tags</div>
                  {(() => {
                    const maxTag = Math.max(...data.top_tags.map((t) => t.count));
                    return data.top_tags.map((tag) => (
                      <HorizontalBar
                        key={tag.name}
                        label={tag.name}
                        value={tag.count}
                        max={maxTag}
                        color={tag.color}
                        count={tag.count}
                      />
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* Projects breakdown */}
            {data.projects.length > 0 && (
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Conversations by Project</div>
                {(() => {
                  const maxProj = Math.max(...data.projects.map((p) => p.count));
                  return data.projects.map((proj) => (
                    <HorizontalBar
                      key={proj.name}
                      label={proj.name}
                      value={proj.count}
                      max={maxProj}
                      color={proj.color}
                      count={proj.count}
                    />
                  ));
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MoveToProjectModal({
  conversation,
  projects,
  onClose,
  onMove,
}: {
  conversation: ConversationDetail;
  projects: ProjectType[];
  onClose: () => void;
  onMove: (conversationId: number, projectId: number | null) => Promise<void>;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    conversation.project?.id || null
  );
  const [moving, setMoving] = useState(false);

  const handleMove = async () => {
    setMoving(true);
    try {
      await onMove(conversation.id, selectedProjectId);
      onClose();
    } catch (error) {
      console.error("Failed to move conversation:", error);
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2>Move to Project</h2>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <p><strong>Conversation:</strong> {conversation.title || "Untitled"}</p>
          <p><strong>Current Project:</strong> {conversation.project?.name || "Uncategorized"}</p>
          
          <div style={{ marginTop: '20px' }}>
            <label><strong>Move to:</strong></label>
            <select
              value={selectedProjectId !== null ? selectedProjectId.toString() : "none"}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedProjectId(val === "none" ? null : parseInt(val));
              }}
              style={{ width: '100%', marginTop: '10px', padding: '8px' }}
            >
              <option value="none">📂 Uncategorized</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  📁 {project.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} disabled={moving}>
              Cancel
            </button>
            <button onClick={handleMove} disabled={moving} className="primary-btn">
              {moving ? "Moving..." : "Move"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
