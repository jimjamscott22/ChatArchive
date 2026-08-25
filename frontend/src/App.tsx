import React, { useState, useEffect } from "react";
import { Sparkles, Upload, Search, Menu, Sun, Moon, MoreVertical, Trash2, Download, Tag, Settings, Copy, Database, ExternalLink, ChevronLeft, ChevronRight, Maximize2, Minimize2, BarChart2, Palette, Home } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import ModalShell from "./components/ModalShell";
import AuthGate from "./components/AuthGate";
import { API_URL, apiFetch, getToken, setUnauthorizedHandler } from "./api";

const PAGE_SIZE = 100;

type ThemeId =
  | 'dark'
  | 'light'
  | 'sepia'
  | 'coffee'
  | 'rose'
  | 'sunset'
  | 'nord'
  | 'dracula'
  | 'solarized-dark'
  | 'ocean'
  | 'forest';

const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: 'dark', label: 'Dark', swatch: 'linear-gradient(135deg, #17130f 0 46%, #33281b 46% 72%, #c4944a 72%)' },
  { id: 'light', label: 'Light', swatch: 'linear-gradient(135deg, #f8f1e4 0 46%, #dfc99f 46% 72%, #8b4513 72%)' },
  { id: 'sepia', label: 'Sepia', swatch: 'linear-gradient(135deg, #f2e4ca 0 46%, #d6ba88 46% 72%, #8a4b1a 72%)' },
  { id: 'coffee', label: 'Coffee', swatch: 'linear-gradient(135deg, #1d120b 0 46%, #4a2f1b 46% 72%, #d49a5c 72%)' },
  { id: 'rose', label: 'Rose', swatch: 'linear-gradient(135deg, #f8ebe8 0 46%, #dfb9b4 46% 72%, #8a2940 72%)' },
  { id: 'sunset', label: 'Sunset', swatch: 'linear-gradient(135deg, #25100e 0 46%, #713824 46% 72%, #f4a261 72%)' },
  { id: 'nord', label: 'Nord', swatch: 'linear-gradient(135deg, #242933 0 46%, #414c5e 46% 72%, #88c0d0 72%)' },
  { id: 'dracula', label: 'Dracula', swatch: 'linear-gradient(135deg, #1f2029 0 46%, #44475a 46% 72%, #bd93f9 72%)' },
  { id: 'solarized-dark', label: 'Solarized', swatch: 'linear-gradient(135deg, #00232b 0 46%, #0d4450 46% 72%, #268bd2 72%)' },
  { id: 'ocean', label: 'Ocean', swatch: 'linear-gradient(135deg, #07192e 0 46%, #154b75 46% 72%, #29b6f6 72%)' },
  { id: 'forest', label: 'Forest', swatch: 'linear-gradient(135deg, #172017 0 46%, #3b5032 46% 72%, #8fbf6e 72%)' },
];

const THEME_STORAGE_KEY = 'chatarchive-theme';

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
  activity_heatmap: number[][];
  peak_window: string | null;
  longest_thread: { title: string; message_count: number } | null;
  response_length_trend: { month: string; avg_words: number }[];
  conversation_depth_buckets: { range: string; count: number }[];
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
  const [authorized, setAuthorized] = useState(() => !!getToken());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [standaloneMode, setStandaloneMode] = useState(() => getInitialConversationId() !== null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [analyticsView, setAnalyticsView] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState<"30d" | "all">("all");
  const [theme, setTheme] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
      if (saved && THEMES.some(t => t.id === saved)) return saved;
    } catch { /* ignore */ }
    return 'dark';
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedConversationIndex, setSelectedConversationIndex] = useState<number>(-1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [showTagModal, setShowTagModal] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [allProjects, setAllProjects] = useState<ProjectType[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showMoveToProjectModal, setShowMoveToProjectModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [supabaseDashboardUrl, setSupabaseDashboardUrl] = useState<string | null>(null);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [fullWidthConvo, setFullWidthConvo] = useState(false);
  const [draggedConversationId, setDraggedConversationId] = useState<number | null>(null);
  const [dragOverProject, setDragOverProject] = useState<number | 'uncategorized' | null>(null);
  const currentThemeLabel = THEMES.find(t => t.id === theme)?.label ?? 'Dark';

  useEffect(() => {
    setUnauthorizedHandler(() => setAuthorized(false));
  }, []);

  // Load conversations on mount (once authorized)
  useEffect(() => {
    if (!authorized) return;
    refreshConversationList(1);
    loadTags();
    loadProjects();
    checkSupabaseConfiguration();
  }, [authorized]);

  // When in standalone mode (opened via ?conversation=id), load that conversation
  useEffect(() => {
    if (!authorized) return;
    const convId = getInitialConversationId();
    if (convId && standaloneMode) {
      loadConversation(convId);
    }
  }, [authorized, standaloneMode]);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch { /* ignore */ }
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.contentEditable === 'true'
      ) {
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
        setShowDuplicatesModal(false);
        setAnalyticsView(false);
        setShowTagModal(false);
        setShowProjectModal(false);
        setShowMoveToProjectModal(false);
        setShowShortcutsModal(false);
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
        setShowShortcutsModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [conversations, selectedConversationIndex, selectedConversation, showMenu, sidebarCollapsed]);

  // Update selected index when conversations change
  useEffect(() => {
    if (selectedConversation && conversations.length > 0) {
      const index = conversations.findIndex(c => c.id === selectedConversation.id);
      setSelectedConversationIndex(index);
    }
  }, [selectedConversation, conversations]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const loadConversations = async (source?: string, page = 1, tag?: string | null, projectId?: number | null, activeTags?: string[], from?: string, to?: string, sbBy?: string, sbOrder?: string) => {
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
      const tagsToSend = activeTags ?? selectedTags;
      tagsToSend.forEach(t => params.append("tags", t));
      if (projectId !== null && projectId !== undefined) {
        params.append("project_id", projectId.toString());
      }
      const df = from ?? dateFrom;
      const dt = to ?? dateTo;
      if (df) params.append("date_from", df);
      if (dt) params.append("date_to", dt);
      params.append("sort_by", sbBy ?? sortBy);
      params.append("sort_order", sbOrder ?? sortOrder);
      const response = await apiFetch(`${API_URL}/conversations?${params}`);
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

  const loadSearchResults = async (
    query: string,
    page = 1,
    source?: string,
    tag?: string | null,
    projectId?: number | null,
    activeTags?: string[],
    from?: string,
    to?: string,
  ) => {
    try {
      setLoading(true);
      setIsSearching(true);
      const params = new URLSearchParams({
        q: query,
        page_size: PAGE_SIZE.toString(),
        page: page.toString(),
      });
      if (source && source !== "all") {
        params.append("source", source);
      }
      if (tag) {
        params.append("tag", tag);
      }
      const tagsToSend = activeTags ?? selectedTags;
      tagsToSend.forEach(t => params.append("tags", t));
      if (projectId !== null && projectId !== undefined) {
        params.append("project_id", projectId.toString());
      }
      const df = from ?? dateFrom;
      const dt = to ?? dateTo;
      if (df) params.append("date_from", df);
      if (dt) params.append("date_to", dt);
      const response = await apiFetch(`${API_URL}/conversations/search?${params}`);
      const data = await response.json();
      setConversations(data.items || []);
      setCurrentPage(data.page ?? page);
      setTotalPages(data.pages ?? 0);
      setLoading(false);
    } catch (error) {
      console.error("Search failed:", error);
      setLoading(false);
    } finally {
      setIsSearching(false);
    }
  };

  const refreshConversationList = (page = currentPage, source?: string, tag?: string | null, projectId?: number | null, activeTags?: string[], from?: string, to?: string, sbBy?: string, sbOrder?: string) => {
    const nextSource = source ?? sourceFilter;
    const nextTag = tag ?? selectedTag;
    const nextProject = projectId !== undefined ? projectId : selectedProject;
    const nextTags = activeTags ?? selectedTags;
    const nextFrom = from !== undefined ? from : dateFrom;
    const nextTo = to !== undefined ? to : dateTo;
    const nextSortBy = sbBy ?? sortBy;
    const nextSortOrder = sbOrder ?? sortOrder;
    if (searchQuery.trim()) {
      loadSearchResults(searchQuery.trim(), page, nextSource, nextTag, nextProject, nextTags, nextFrom, nextTo);
      return;
    }
    loadConversations(nextSource, page, nextTag, nextProject, nextTags, nextFrom, nextTo, nextSortBy, nextSortOrder);
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1) return;
    if (totalPages && nextPage > totalPages) return;
    refreshConversationList(nextPage);
  };

  const loadConversation = async (id: number) => {
    try {
      const response = await apiFetch(`${API_URL}/conversations/${id}`);
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
      setIsSearching(false);
      loadConversations(sourceFilter, 1, selectedTag, selectedProject);
      return;
    }

    await loadSearchResults(query.trim(), 1, sourceFilter, selectedTag, selectedProject);
  };

  // Tag-related functions
  const loadTags = async () => {
    try {
      const response = await apiFetch(`${API_URL}/tags`);
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
      const response = await apiFetch(`${API_URL}/projects`);
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
    refreshConversationList(1, undefined, tagName, selectedProject);
  };

  const handleProjectFilter = (projectId: number | null) => {
    setSelectedProject(projectId);
    setCurrentPage(1);
    refreshConversationList(1, undefined, selectedTag, projectId);
  };

  const handleMultiTagToggle = (tagName: string) => {
    const next = selectedTags.includes(tagName)
      ? selectedTags.filter(t => t !== tagName)
      : [...selectedTags, tagName];
    setSelectedTags(next);
    setCurrentPage(1);
    refreshConversationList(1, undefined, selectedTag, selectedProject, next);
  };

  const handleDateFrom = (value: string) => {
    setDateFrom(value);
    setCurrentPage(1);
    refreshConversationList(1, undefined, selectedTag, selectedProject, selectedTags, value, dateTo);
  };

  const handleDateTo = (value: string) => {
    setDateTo(value);
    setCurrentPage(1);
    refreshConversationList(1, undefined, selectedTag, selectedProject, selectedTags, dateFrom, value);
  };

  const handleSortChange = (newSortBy: string, newSortOrder: string) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setCurrentPage(1);
    refreshConversationList(1, undefined, selectedTag, selectedProject, selectedTags, dateFrom, dateTo, newSortBy, newSortOrder);
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSourceFilter("all");
    setSelectedTag(null);
    setSelectedTags([]);
    setSelectedProject(null);
    setDateFrom("");
    setDateTo("");
    setSortBy("created_at");
    setSortOrder("desc");
    setCurrentPage(1);
    setIsSearching(false);
    loadConversations("all", 1, null, null, [], "", "");
  };

  const checkSupabaseConfiguration = async () => {
    try {
      const response = await apiFetch(`${API_URL}/settings/supabase-dashboard-url`);
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
      const response = await apiFetch(`${API_URL}/conversations/auto-tag`, {
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
      const response = await apiFetch(`${API_URL}/conversations/${conversationId}/tags/${tagId}`, {
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
      const response = await apiFetch(`${API_URL}/projects`, {
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
      const response = await apiFetch(`${API_URL}/conversations/${conversationId}/move`, {
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

  const getDateGroupLabel = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "Undated";
    const date = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    const startOfWeek = new Date(startOfToday.getTime() - (now.getDay() * 86400000));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (date >= startOfToday) return "Today";
    if (date >= startOfYesterday) return "Yesterday";
    if (date >= startOfWeek) return "This Week";
    if (date >= startOfMonth) return "This Month";

    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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
      loadSearchResults(searchQuery.trim(), 1, source, selectedTag, selectedProject);
      return;
    }
    loadConversations(source, 1, selectedTag, selectedProject);
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation || !confirm('Delete this conversation?')) return;

    try {
      await apiFetch(`${API_URL}/conversations/${selectedConversation.id}`, {
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
  const sourceBreakdown = Object.entries(
    conversations.reduce((acc, conv) => {
      acc[conv.source] = (acc[conv.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort(([, countA], [, countB]) => countB - countA);
  const totalMessagesInView = conversations.reduce((sum, conv) => sum + conv.message_count, 0);
  const visibleProjects = new Set(
    conversations.map((conv) => conv.project?.id).filter((projectId): projectId is number => projectId !== undefined)
  );
  const uncategorizedCount = conversations.filter((conv) => !conv.project).length;
  const recentConversations = conversations.slice(0, 4);
  const supportedSources = ["chatgpt", "claude", "gemini", "copilot"];
  const topTags = [...allTags]
    .sort((tagA, tagB) => tagB.conversation_count - tagA.conversation_count)
    .slice(0, 5);
  const topProjects = [...allProjects]
    .sort((projectA, projectB) => projectB.conversation_count - projectA.conversation_count)
    .slice(0, 4);
  const hasActiveFilters =
    sourceFilter !== "all" ||
    selectedTag !== null ||
    selectedTags.length > 0 ||
    selectedProject !== null ||
    Boolean(highlightQuery) ||
    Boolean(dateFrom) ||
    Boolean(dateTo);
  const selectedProjectLabel =
    selectedProject === null
      ? null
      : selectedProject === -1
        ? "Uncategorized"
        : allProjects.find((project) => project.id === selectedProject)?.name || "Selected project";
  const activeFilters = [
    sourceFilter !== "all" ? getSourceInfo(sourceFilter).name : null,
    selectedTag ? `Tag: ${selectedTag}` : null,
    ...(selectedTags.length > 0 ? selectedTags.map(t => `Tag: ${t}`) : []),
    selectedProjectLabel ? `Project: ${selectedProjectLabel}` : null,
    highlightQuery ? `Search: "${highlightQuery}"` : null,
    dateFrom ? `From: ${dateFrom}` : null,
    dateTo ? `To: ${dateTo}` : null,
  ].filter((value): value is string => Boolean(value));

  if (!authorized) {
    return <AuthGate onSuccess={() => setAuthorized(true)} />;
  }

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
              <button
                className="icon-btn keyboard-shortcut-hint"
                title="Press Shift+? for keyboard shortcuts"
                aria-label="Open keyboard shortcuts"
                onClick={() => setShowShortcutsModal(true)}
              >
                <span className="keyboard-hint">⌨️</span>
              </button>
            )}
            <button className="icon-btn" title="Toggle theme" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        <div className="sidebar-scroll-area">
          {!sidebarCollapsed && (
            <div className="sidebar-top">
              <button
                className={`sidebar-home-btn${!analyticsView && !selectedConversation ? " active" : ""}`}
                onClick={() => { setAnalyticsView(false); setSelectedConversation(null); }}
              >
                <Home size={14} />
                Home
              </button>

              <div className="search-box">
                <label className="sr-only" htmlFor="conversation-search">Search conversations</label>
                <Search size={16} className="search-icon" />
                <input
                  id="conversation-search"
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>

              <section className="sidebar-panel sidebar-primary-panel">
                <div className="sidebar-panel-header">
                  <div>
                    <p className="sidebar-panel-label">Library</p>
                    <h2 className="sidebar-panel-title">{highlightQuery ? "Search results" : "Browse archive"}</h2>
                  </div>
                  <span className="sidebar-panel-meta">{conversations.length} shown</span>
                </div>

                <button className="import-btn" onClick={() => setShowImportModal(true)}>
                  <Upload size={16} />
                  Import Conversations
                </button>

                <div className="sidebar-summary-grid">
                  <div className="sidebar-summary-card">
                    <span className="sidebar-summary-label">Messages</span>
                    <strong>{totalMessagesInView}</strong>
                  </div>
                  <div className="sidebar-summary-card">
                    <span className="sidebar-summary-label">Sources</span>
                    <strong>{sourceBreakdown.length}</strong>
                  </div>
                </div>
              </section>

              <section className="sidebar-panel">
                <div className="sidebar-panel-header">
                  <div>
                    <p className="sidebar-panel-label">Filters</p>
                    <h2 className="sidebar-panel-title">Narrow the view</h2>
                  </div>
                  {hasActiveFilters && (
                    <button className="sidebar-inline-action" onClick={clearAllFilters}>
                      Clear
                    </button>
                  )}
                </div>

                <div className="sidebar-filters">
                  <div className="source-filter">
                    <label htmlFor="source-filter">Filter by source:</label>
                    <select id="source-filter" value={sourceFilter} onChange={(e) => handleSourceFilter(e.target.value)}>
                      <option value="all">All Sources</option>
                      <option value="chatgpt">💬 ChatGPT</option>
                      <option value="claude">🤖 Claude</option>
                      <option value="gemini">✨ Gemini</option>
                      <option value="copilot">👨‍💻 Copilot</option>
                    </select>
                  </div>

                  <div className="tag-filter">
                    <span className="filter-label" id="tag-filter-label">Filter by tag:</span>
                    <div
                      className="tag-filter-chips"
                      role="group"
                      aria-labelledby="tag-filter-label"
                    >
                      {allTags.map((tag) => (
                        <button
                          key={tag.id}
                          className={`tag-filter-chip${selectedTags.includes(tag.name) ? " active" : ""}`}
                          onClick={() => handleMultiTagToggle(tag.name)}
                          aria-pressed={selectedTags.includes(tag.name)}
                          title={`${tag.conversation_count} conversations`}
                        >
                          {tag.name} <span className="tag-count">({tag.conversation_count})</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="project-filter">
                    <label htmlFor="project-filter">Filter by project:</label>
                    <select
                      id="project-filter"
                      value={selectedProject !== null ? selectedProject.toString() : "all"}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "all") {
                          handleProjectFilter(null);
                        } else if (val === "-1") {
                          handleProjectFilter(-1);
                        } else {
                          handleProjectFilter(parseInt(val, 10));
                        }
                      }}
                    >
                      <option value="all">All Projects</option>
                      <option value="-1">📂 Uncategorized ({uncategorizedCount})</option>
                      {allProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          📁 {project.name} ({project.conversation_count})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="date-filter">
                    <label>Date range:</label>
                    <div className="date-filter-inputs">
                      <input
                        type="date"
                        className="date-input"
                        value={dateFrom}
                        onChange={(e) => handleDateFrom(e.target.value)}
                        title="From date"
                      />
                      <span className="date-separator">–</span>
                      <input
                        type="date"
                        className="date-input"
                        value={dateTo}
                        onChange={(e) => handleDateTo(e.target.value)}
                        title="To date"
                      />
                    </div>
                  </div>

                  <div className="sort-filter">
                    <label>Sort:</label>
                    <div className="sort-filter-controls">
                      <select
                        value={sortBy}
                        onChange={(e) => handleSortChange(e.target.value, sortOrder)}
                        className="sort-select"
                      >
                        <option value="created_at">Date created</option>
                        <option value="updated_at">Last updated</option>
                        <option value="title">Title</option>
                        <option value="message_count">Message count</option>
                      </select>
                      <button
                        className={`sort-order-btn${sortOrder === "asc" ? " active" : ""}`}
                        onClick={() => handleSortChange(sortBy, sortOrder === "desc" ? "asc" : "desc")}
                        title={sortOrder === "desc" ? "Newest first — click to flip" : "Oldest first — click to flip"}
                      >
                        {sortOrder === "desc" ? "↓" : "↑"}
                      </button>
                    </div>
                  </div>

                  {allProjects.length > 0 && (
                    <div className={`project-drop-zones ${draggedConversationId ? "drag-mode" : ""}`}>
                      <label>Projects - drag here to assign</label>
                      <div
                        className={`project-drop-zone${dragOverProject === "uncategorized" ? " drag-over" : ""}`}
                        role="button"
                        tabIndex={0}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverProject("uncategorized");
                        }}
                        onDragLeave={() => setDragOverProject(null)}
                        onDrop={async () => {
                          if (draggedConversationId !== null) {
                            await moveConversationToProject(draggedConversationId, null);
                          }
                          setDragOverProject(null);
                          setDraggedConversationId(null);
                        }}
                        onClick={() => handleProjectFilter(-1)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleProjectFilter(-1);
                          }
                        }}
                        title="Uncategorized conversations"
                      >
                        📂 Uncategorized
                      </div>
                      {allProjects.map((project) => (
                        <div
                          key={project.id}
                          className={`project-drop-zone${dragOverProject === project.id ? " drag-over" : ""}`}
                          style={{ borderLeftColor: project.color || "#8B5CF6" }}
                          role="button"
                          tabIndex={0}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverProject(project.id);
                          }}
                          onDragLeave={() => setDragOverProject(null)}
                          onDrop={async () => {
                            if (draggedConversationId !== null) {
                              await moveConversationToProject(draggedConversationId, project.id);
                            }
                            setDragOverProject(null);
                            setDraggedConversationId(null);
                          }}
                          onClick={() => handleProjectFilter(project.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleProjectFilter(project.id);
                            }
                          }}
                          title={project.description || project.name}
                        >
                          <span
                            className="project-drop-color-dot"
                            style={{ backgroundColor: project.color || "#8B5CF6" }}
                          />
                          {project.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="sidebar-panel sidebar-tools-panel">
                <div className="sidebar-panel-header">
                  <div>
                    <p className="sidebar-panel-label">Tools</p>
                    <h2 className="sidebar-panel-title">Organize the archive</h2>
                  </div>
                </div>

                <div className="sidebar-tool-grid">
                  <button
                    className={`sidebar-tool-btn${analyticsView ? " active" : ""}`}
                    onClick={() => { setAnalyticsView(true); setSelectedConversation(null); }}
                  >
                    <BarChart2 size={16} />
                    Analytics
                  </button>

                  <button className="sidebar-tool-btn" onClick={() => setShowDuplicatesModal(true)}>
                    <Copy size={16} />
                    Duplicates
                  </button>

                  <button
                    className="sidebar-tool-btn sidebar-tool-btn-accent"
                    onClick={autoTagAllConversations}
                    disabled={autoTagging}
                    title="Automatically tag all conversations based on content"
                  >
                    <Tag size={16} />
                    {autoTagging ? "Auto-tagging..." : "Auto-tag all"}
                  </button>

                  <button className="sidebar-tool-btn" onClick={() => setShowTagModal(true)}>
                    <Tag size={16} />
                    Manage tags
                  </button>

                  <button className="sidebar-tool-btn" onClick={() => setShowProjectModal(true)}>
                    <Settings size={16} />
                    Manage projects
                  </button>

                  <button className="sidebar-tool-btn" onClick={() => setShowSettingsModal(true)}>
                    <Settings size={16} />
                    Settings
                  </button>
                </div>
              </section>
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
              (() => {
                let lastGroup = "";
                return conversations.map((conv) => {
                  const group = getDateGroupLabel(conv.updated_at || conv.created_at);
                  const showDivider = group !== lastGroup;
                  lastGroup = group;
                  return (
                    <div key={conv.id}>
                      {showDivider && (
                        <div className="convo-date-group">
                          <span className="convo-date-group-label">{group}</span>
                          <span className="convo-date-group-line" />
                        </div>
                      )}
                <div
                  className={`conversation-card ${selectedConversation?.id === conv.id ? "active" : ""} ${draggedConversationId === conv.id ? "dragging" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedConversation?.id === conv.id}
                  aria-label={conv.title || "Untitled conversation"}
                  onClick={() => loadConversation(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      loadConversation(conv.id);
                    }
                  }}
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
                        <button 
                          key={tag.id} 
                          type="button"
                          className="tag tag-badge tag-filter-chip" 
                          style={{
                            backgroundColor: tag.color || '#6B7280',
                            color: 'white',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTagFilter(tag.name);
                          }}
                          title={tag.description || tag.name}
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {conv.project && (
                    <div className="card-project">
                      <button 
                        type="button"
                        className="project-badge project-badge-btn" 
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
                      </button>
                    </div>
                  )}
                </div>
                    </div>
                  );
                });
              })()
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
        </div>

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
          <div className="main-header-top">
            <div className="main-header-leading">
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
            </div>

            <div className="main-header-text">
              <p className="header-kicker">
                {analyticsView
                  ? "Archive Analytics"
                  : selectedConversation
                    ? getSourceInfo(selectedConversation.source).name
                    : highlightQuery
                      ? "Search results"
                      : "Archive overview"}
              </p>
              <h2 className="header-title">
                {analyticsView
                  ? "What your archive tells you"
                  : selectedConversation?.title || "Browse and organize your conversations"}
              </h2>
              {!selectedConversation && !analyticsView && (
                <p className="header-subtitle">
                  Use the sidebar to filter the archive, then pick a conversation to preview here or open it in a
                  dedicated window.
                </p>
              )}
            </div>

            {analyticsView && (
              <div className="header-actions">
                <div className="analytics-range-toggle">
                  <button
                    className={analyticsRange === "30d" ? "active" : ""}
                    onClick={() => setAnalyticsRange("30d")}
                  >
                    30d
                  </button>
                  <button
                    className={analyticsRange === "all" ? "active" : ""}
                    onClick={() => setAnalyticsRange("all")}
                  >
                    All time
                  </button>
                </div>
              </div>
            )}

            {selectedConversation && (
              <div className="header-actions">
                <div className="header-buttons">
                  <button
                    className="icon-btn icon-btn-danger"
                    onClick={handleDeleteConversation}
                    title="Delete conversation"
                  >
                    <Trash2 size={20} />
                  </button>
                  <button className="icon-btn" onClick={() => setShowMenu(!showMenu)} title="More options">
                    <MoreVertical size={20} />
                  </button>
                </div>
                {showMenu && (
                  <div className="dropdown-menu">
                    <button
                      className="menu-item"
                      onClick={() => {
                        setShowMoveToProjectModal(true);
                        setShowMenu(false);
                      }}
                    >
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
          </div>

          {selectedConversation && (
            <div className="main-header-meta">
              <span className="header-meta-pill source-pill" data-source={selectedConversation.source}>
                {getSourceInfo(selectedConversation.source).icon} {getSourceInfo(selectedConversation.source).name}
              </span>

              {selectedConversation.project && (
                <button
                  className="header-meta-pill project-pill"
                  style={{ backgroundColor: selectedConversation.project.color || "#8B5CF6" }}
                  onClick={() => handleProjectFilter(selectedConversation.project!.id)}
                  title={selectedConversation.project.description || selectedConversation.project.name}
                >
                  📁 {selectedConversation.project.name}
                </button>
              )}

              <span className="header-meta-pill">{selectedConversation.message_count} messages</span>

              {selectedConversation.word_count ? (
                <span className="header-meta-pill">{estimateReadingTime(selectedConversation.word_count)}</span>
              ) : null}

              <span className="header-meta-pill">
                Updated {getRelativeTime(selectedConversation.updated_at || selectedConversation.created_at)}
              </span>

              {selectedConversation.tags && selectedConversation.tags.length > 0 && (
                <div className="conversation-tags-header">
                  {selectedConversation.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="tag tag-badge"
                      style={{
                        backgroundColor: tag.color || "#6B7280",
                        color: "white",
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
                        style={{
                          marginLeft: "4px",
                          cursor: "pointer",
                          border: "none",
                          background: "transparent",
                          color: "white",
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>

        <div className="content-area content-area-scrollable">
          {analyticsView ? (
            <AnalyticsScreen range={analyticsRange} />
          ) : !selectedConversation ? (
            <div className="overview-layout">
              <section className="overview-hero">
                <div className="overview-hero-copy">
                  <span className="overview-kicker">ChatArchive</span>
                  <h2 className="overview-title">
                    {conversations.length === 0
                      ? hasActiveFilters
                        ? "No conversations match this view"
                        : "Bring your AI conversations into one calm workspace"
                      : "Your archive is ready to browse"}
                  </h2>
                  <p className="overview-description">
                    {conversations.length === 0
                      ? hasActiveFilters
                        ? "Try clearing a filter or broadening your search to bring conversations back into view."
                        : "Import a chat export to start searching, tagging, and organizing everything in one local-first workspace."
                      : "Use the sidebar to filter the archive, then preview any conversation here or pop it into a dedicated reading window."}
                  </p>
                  <div className="overview-chip-list">
                    {supportedSources.map((source) => (
                      <span key={source} className="overview-chip">
                        {getSourceInfo(source).icon} {getSourceInfo(source).name}
                      </span>
                    ))}
                    <span className="overview-chip">Local-first archive</span>
                  </div>
                </div>

                <div className="overview-hero-actions">
                  <button className="empty-action-btn" onClick={() => setShowImportModal(true)}>
                    <Upload size={16} />
                    Import Conversations
                  </button>
                  {hasActiveFilters && (
                    <button className="overview-secondary-btn" onClick={clearAllFilters}>
                      Clear filters
                    </button>
                  )}
                  {!hasActiveFilters && conversations.length > 0 && recentConversations[0] && (
                    <button className="overview-secondary-btn" onClick={() => loadConversation(recentConversations[0].id)}>
                      Open latest conversation
                    </button>
                  )}
                  {!hasActiveFilters && conversations.length > 0 && (
                    <button className="overview-secondary-btn" onClick={() => setAnalyticsView(true)}>
                      Review analytics
                    </button>
                  )}
                </div>
              </section>

              {loading || isSearching ? (
                <div className="skeleton-container center-skeleton">
                  {Array.from({ length: 4 }).map((_, i) => (
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
                <div className="overview-panels">
                  <section className="overview-panel overview-empty-panel">
                    <div className="overview-panel-header">
                      <div>
                        <h3>{hasActiveFilters ? "Current filters" : "Getting started"}</h3>
                        <p>
                          {hasActiveFilters
                            ? "These filters are active right now."
                            : "A few helpful next steps once you import your first archive."}
                        </p>
                      </div>
                    </div>

                    {hasActiveFilters ? (
                      <div className="overview-chip-list">
                        {activeFilters.map((filterLabel) => (
                          <span key={filterLabel} className="overview-chip">
                            {filterLabel}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="overview-onboarding-grid">
                        <div className="overview-onboarding-card">
                          <span className="overview-section-label">Supported imports</span>
                          <div className="overview-source-list">
                            {supportedSources.map((source) => (
                              <div key={source} className="overview-source-row">
                                <span className="overview-source-name">
                                  <span className="source-indicator">{getSourceInfo(source).icon}</span>
                                  {getSourceInfo(source).name}
                                </span>
                                <strong>Ready</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="overview-onboarding-card">
                          <span className="overview-section-label">After import</span>
                          <div className="overview-checklist">
                            <div className="overview-check-item">Search across titles and message content from one place.</div>
                            <div className="overview-check-item">Use tags and projects to group related work.</div>
                            <div className="overview-check-item">Open long threads in a dedicated reader when you want a calmer view.</div>
                          </div>
                          <p className="overview-empty-copy">Your archive stays local unless you explicitly connect external storage.</p>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              ) : (
                <>
                  <div className="overview-stats-grid">
                    <article className="overview-stat-card">
                      <span className="overview-stat-label">Conversations in view</span>
                      <strong>{conversations.length}</strong>
                    </article>
                    <article className="overview-stat-card">
                      <span className="overview-stat-label">Messages in view</span>
                      <strong>{totalMessagesInView}</strong>
                    </article>
                    <article className="overview-stat-card">
                      <span className="overview-stat-label">Projects represented</span>
                      <strong>{visibleProjects.size + (uncategorizedCount > 0 ? 1 : 0)}</strong>
                    </article>
                    <article className="overview-stat-card">
                      <span className="overview-stat-label">Sources represented</span>
                      <strong>{sourceBreakdown.length}</strong>
                    </article>
                  </div>

                  <div className="overview-panels">
                    <section className="overview-panel">
                      <div className="overview-panel-header">
                        <div>
                          <h3>Recent conversations</h3>
                          <p>The latest items in your current view.</p>
                        </div>
                      </div>

                      <div className="overview-recent-list">
                        {recentConversations.map((conv) => (
                          <article key={conv.id} className="overview-conversation-card">
                            <button className="overview-conversation-main" onClick={() => loadConversation(conv.id)}>
                              <div className="source-avatar" data-source={conv.source}>
                                {getSourceInfo(conv.source).icon}
                              </div>
                              <div className="overview-conversation-copy">
                                <h4>{renderHighlightedText(conv.title || "Untitled", highlightQuery)}</h4>
                                <p>{renderHighlightedText(getMessagePreview(conv), highlightQuery)}</p>
                                <div className="overview-conversation-meta">
                                  <span>{getRelativeTime(conv.updated_at || conv.created_at)}</span>
                                  <span>{conv.message_count} messages</span>
                                  {conv.word_count ? <span>{estimateReadingTime(conv.word_count)}</span> : null}
                                </div>
                              </div>
                            </button>

                            <button
                              className="icon-btn overview-conversation-launch"
                              title="Open in new window"
                              onClick={(e) => openConversationInNewWindow(conv.id, e)}
                            >
                              <ExternalLink size={16} />
                            </button>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section className="overview-panel">
                      <div className="overview-panel-header">
                        <div>
                          <h3>Current focus</h3>
                          <p>What this view is showing right now.</p>
                        </div>
                      </div>

                      <div className="overview-focus-stack">
                        <div>
                          <span className="overview-section-label">Active filters</span>
                          <div className="overview-chip-list">
                            {activeFilters.length > 0 ? (
                              activeFilters.map((filterLabel) => (
                                <span key={filterLabel} className="overview-chip">
                                  {filterLabel}
                                </span>
                              ))
                            ) : (
                              <span className="overview-empty-copy">No filters applied. You're looking at the broad archive view.</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="overview-section-label">Source mix</span>
                          <div className="overview-source-list">
                            {sourceBreakdown.map(([source, count]) => (
                              <div key={source} className="overview-source-row">
                                <span className="overview-source-name">
                                  <span className="source-indicator">{getSourceInfo(source).icon}</span>
                                  {getSourceInfo(source).name}
                                </span>
                                <strong>{count}</strong>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="overview-section-label">Archive health</span>
                          <div className="overview-mini-stat-grid">
                            <div className="overview-mini-stat">
                              <strong>{allTags.length}</strong>
                              <span>saved tags</span>
                            </div>
                            <div className="overview-mini-stat">
                              <strong>{allProjects.length}</strong>
                              <span>projects</span>
                            </div>
                            <div className="overview-mini-stat">
                              <strong>{uncategorizedCount}</strong>
                              <span>uncategorized in view</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <span className="overview-section-label">Top tags</span>
                          <div className="overview-chip-list">
                            {topTags.length > 0 ? (
                              topTags.map((tag) => (
                                <button
                                  key={tag.id}
                                  type="button"
                                  className="overview-chip overview-chip-button"
                                  onClick={() => handleTagFilter(tag.name)}
                                >
                                  {tag.name} ({tag.conversation_count})
                                </button>
                              ))
                            ) : (
                              <span className="overview-empty-copy">Tags will appear here after you import or classify conversations.</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="overview-section-label">Top projects</span>
                          <div className="overview-chip-list">
                            {topProjects.length > 0 ? (
                              topProjects.map((project) => (
                                <button
                                  key={project.id}
                                  type="button"
                                  className="overview-chip overview-chip-button"
                                  onClick={() => handleProjectFilter(project.id)}
                                >
                                  {project.name} ({project.conversation_count})
                                </button>
                              ))
                            ) : (
                              <span className="overview-empty-copy">Create projects once you want to group related threads.</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="overview-section-label">Quick actions</span>
                          <div className="overview-action-grid">
                            <button type="button" className="overview-secondary-btn" onClick={() => setAnalyticsView(true)}>
                              Open analytics
                            </button>
                            <button type="button" className="overview-secondary-btn" onClick={() => setShowTagModal(true)}>
                              Manage tags
                            </button>
                            <button type="button" className="overview-secondary-btn" onClick={() => setShowProjectModal(true)}>
                              Manage projects
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
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

      {showShortcutsModal && (
        <KeyboardShortcutsModal onClose={() => setShowShortcutsModal(false)} />
      )}

      <div className="theme-palette-wrapper">
        <button
          className="theme-palette-btn"
          onClick={() => setPaletteOpen(o => !o)}
          title="Choose theme"
          aria-label={`Choose theme. Current: ${currentThemeLabel}`}
          aria-expanded={paletteOpen}
        >
          <Palette size={30} />
          <span className="theme-palette-label">Theme</span>
        </button>
        {paletteOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 499 }}
              onClick={() => setPaletteOpen(false)}
            />
            <div className="theme-palette-menu" role="menu" style={{ zIndex: 501 }}>
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={`theme-option ${theme === t.id ? 'active' : ''}`}
                  onClick={() => { setTheme(t.id); setPaletteOpen(false); }}
                  role="menuitemradio"
                  aria-checked={theme === t.id}
                >
                  <span className="theme-swatch" style={{ background: t.swatch }} />
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
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
      const response = await apiFetch(
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
      const response = await apiFetch(`${API_URL}/tags/${tag.id}`, {
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
    <ModalShell title="Manage Tags" onClose={onClose} className="tag-manager-modal" bodyClassName="tag-manager-content">
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
    </ModalShell>
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
      const response = await apiFetch(`${API_URL}/import/${source}`, {
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
    </ModalShell>
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
    try {
      const response = await apiFetch(`${API_URL}/settings/import`, {
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
      const response = await apiFetch(`${API_URL}/import/history/${historyId}?delete_conversations=true`, {
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
    </ModalShell>
  );
}

function DuplicatesModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [duplicates, setDuplicates] = useState<DuplicatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    try {
      const response = await apiFetch(`${API_URL}/conversations/duplicates?strategy=${strategy}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setDuplicates(data);
    } catch (error) {
      console.error("Failed to load duplicates:", error);
      setDuplicates(null);
      setError("Couldn't load duplicate scan. Please try again.");
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
      const response = await apiFetch(`${API_URL}/conversations/bulk`, {
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
    <ModalShell
      title="Find Duplicate Conversations"
      onClose={onClose}
      className="duplicates-modal"
      actions={
        <>
          <button onClick={onClose}>Cancel</button>
          <button
            className="danger"
            onClick={handleBulkDelete}
            disabled={selectedForDeletion.size === 0 || deleting}
          >
            {deleting ? "Deleting..." : `Delete Selected (${selectedForDeletion.size})`}
          </button>
        </>
      }
    >
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
        ) : error ? (
          <div className="status-error">{error}</div>
        ) : !duplicates || duplicates.groups.length === 0 ? (
          <div className="empty">
            <p>No duplicate conversations found!</p>
            <small>Try a different detection method or import more conversations.</small>
          </div>
        ) : (
          <div className="duplicate-groups">
            {duplicates.groups.map((group) => (
                <div key={group.key} className="duplicate-group">
                  <div
                    className="group-header"
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedGroups.has(group.key)}
                    onClick={() => toggleGroupExpanded(group.key)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleGroupExpanded(group.key);
                      }
                    }}
                  >
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
    </ModalShell>
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
      const response = await apiFetch(`${API_URL}/projects`, {
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
      const response = await apiFetch(`${API_URL}/projects/${project.id}`, {
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
    <ModalShell title="Manage Projects" onClose={onClose} className="tag-manager-modal" bodyClassName="tag-manager-content">
      <form onSubmit={handleSubmit} className="tag-form">
        <h3>Create New Project</h3>
        <div className="form-group">
          <label htmlFor="project-name">Project name</label>
          <input
            id="project-name"
            type="text"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="project-description">Description</label>
          <input
            id="project-description"
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="form-group">
          <label>Color</label>
          <div className="tag-color-row">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={saving}
              aria-label="Project color"
            />
            <span className="tag-preview" style={{ backgroundColor: color }}>
              {name.trim() || "Preview"}
            </span>
          </div>
        </div>
        <div className="tag-form-actions">
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Creating..." : "Create Project"}
          </button>
        </div>
        {status && <div className="status-success">{status}</div>}
        {error && <div className="status-error">{error}</div>}
      </form>

      <div className="tag-list">
        <div className="tag-list-header">Existing projects</div>
        {projects.length === 0 ? (
          <div className="empty">No projects yet. Create one above.</div>
        ) : (
          <div className="tag-list-items">
            {projects.map((project) => (
              <div key={project.id} className="tag-row">
                <div className="tag-row-main">
                  <span className="tag-badge" style={{ backgroundColor: project.color || "#8B5CF6", color: "white" }}>
                    {project.name}
                  </span>
                  <div className="tag-row-info">
                    <div className="tag-row-name">{project.name}</div>
                    <div className="tag-row-meta">
                      {project.description || "No description"}
                    </div>
                  </div>
                </div>
                <div className="tag-row-actions">
                  <span className="tag-count">{project.conversation_count} conv</span>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDelete(project)}
                    disabled={saving}
                    title="Delete project"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function AnalyticsScreen({ range }: { range: "30d" | "all" }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const qs = range === "30d" ? "?days=30" : "";
    apiFetch(`${API_URL}/analytics${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [range]);

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const HOUR_LABELS = ["12a", "6a", "12p", "6p", "11p"];

  const SOURCE_COLORS: Record<string, string> = {
    chatgpt: "var(--chatgpt-color, #10a37f)",
    claude: "var(--claude-color, #d97757)",
    gemini: "var(--gemini-color, #4285f4)",
    copilot: "var(--copilot-color, #8957e5)",
  };

  const SOURCE_NAMES: Record<string, string> = {
    chatgpt: "ChatGPT",
    claude: "Claude",
    gemini: "Gemini",
    copilot: "Copilot",
  };

  const sourceName = (src: string) => SOURCE_NAMES[src] || (src.charAt(0).toUpperCase() + src.slice(1));

  function InsightCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
    return (
      <div className="analytics-insight-card">
        <span className="analytics-insight-label">{label}</span>
        <strong className="analytics-insight-value">{value}</strong>
        <span className="analytics-insight-subtitle">{subtitle}</span>
      </div>
    );
  }

  if (loading) {
    return <div className="analytics-screen"><div className="analytics-state">Loading analytics…</div></div>;
  }
  if (error) {
    return <div className="analytics-screen"><div className="status-error">Failed to load analytics: {error}</div></div>;
  }
  if (!data) return null;

  if (data.total_conversations === 0) {
    return (
      <div className="analytics-screen">
        <div className="analytics-empty-state">
          <h3>No analytics yet</h3>
          <p>{range === "30d" ? "Nothing imported in the last 30 days." : "Import some conversations to see insights about your archive."}</p>
        </div>
      </div>
    );
  }

  const sourceEntries = Object.entries(data.sources).sort((a, b) => b[1] - a[1]);
  const [topSourceName, topSourceCount] = sourceEntries[0] ?? ["—", 0];
  const runnerUp = sourceEntries[1];
  const sourceRatioLabel = runnerUp && runnerUp[1] > 0
    ? `${(topSourceCount / runnerUp[1]).toFixed(1)}× vs ${sourceName(runnerUp[0])}`
    : sourceEntries.length > 0
      ? "only source used"
      : "—";

  const topTag = data.top_tags[0];
  const tagShare = topTag && data.total_conversations > 0
    ? `${Math.round((topTag.count / data.total_conversations) * 100)}% of conversations`
    : "—";

  const heatmapMax = Math.max(1, ...data.activity_heatmap.flat());
  const trendWords = data.response_length_trend.map((t) => t.avg_words);
  const trendMax = Math.max(1, ...trendWords);
  const trendDirection = trendWords.length >= 2
    ? trendWords[trendWords.length - 1] >= trendWords[0] ? "trending up" : "trending down"
    : "";

  const depthMax = Math.max(1, ...data.conversation_depth_buckets.map((b) => b.count));
  const busiestBucket = data.conversation_depth_buckets.reduce(
    (best, b) => (b.count > best.count ? b : best),
    data.conversation_depth_buckets[0]
  );

  return (
    <div className="analytics-screen">
      <div className="analytics-insight-row">
        <InsightCard label="most used for" value={topTag?.name ?? "—"} subtitle={tagShare} />
        <InsightCard
          label="go-to model"
          value={topSourceName === "—" ? "—" : sourceName(topSourceName)}
          subtitle={sourceRatioLabel}
        />
        <InsightCard
          label="longest thread"
          value={data.longest_thread?.title ?? "—"}
          subtitle={data.longest_thread ? `${data.longest_thread.message_count} messages` : "—"}
        />
        <InsightCard label="peak window" value={data.peak_window ?? "—"} subtitle="your busiest slot" />
      </div>

      <div className="analytics-two-col">
        <section className="analytics-panel">
          <div className="analytics-panel-title">Activity heatmap — day &times; hour</div>
          <div className="analytics-heatmap">
            <div className="analytics-heatmap-day-labels">
              {DAY_NAMES.map((d) => <span key={d}>{d}</span>)}
            </div>
            <div className="analytics-heatmap-grid">
              {data.activity_heatmap.map((row, dayIdx) =>
                row.map((count, bucketIdx) => (
                  <div
                    key={`${dayIdx}-${bucketIdx}`}
                    className="analytics-heatmap-cell"
                    style={{ opacity: count === 0 ? 0.06 : 0.18 + (count / heatmapMax) * 0.82 }}
                    title={`${DAY_NAMES[dayIdx]} ${bucketIdx * 2}:00–${bucketIdx * 2 + 1}:59 — ${count} messages`}
                  />
                ))
              )}
            </div>
          </div>
          <div className="analytics-heatmap-hour-labels">
            {HOUR_LABELS.map((h) => <span key={h}>{h}</span>)}
          </div>
        </section>

        <section className="analytics-panel">
          <div className="analytics-panel-title">Source mix</div>
          <div className="analytics-source-mix">
            {sourceEntries.map(([src, count]) => {
              const pct = data.total_conversations > 0 ? Math.round((count / data.total_conversations) * 100) : 0;
              return (
                <div key={src} className="analytics-source-row">
                  <div className="analytics-source-row-label">
                    <span>{sourceName(src)}</span>
                    <b>{count}</b>
                  </div>
                  <div className="analytics-source-bar-track">
                    <div
                      className="analytics-source-bar-fill"
                      style={{ width: `${pct}%`, background: SOURCE_COLORS[src] || "var(--accent)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {data.top_tags.length > 0 && (
            <>
              <div className="analytics-panel-title analytics-panel-title-spaced">Top topics</div>
              <div className="analytics-tag-pills">
                {data.top_tags.slice(0, 6).map((tag) => (
                  <span
                    key={tag.name}
                    className="analytics-tag-pill"
                    style={{ borderColor: tag.color, color: tag.color }}
                  >
                    {tag.name} {tag.count}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="analytics-two-col">
        <section className="analytics-panel">
          <div className="analytics-panel-title">Response length trend</div>
          {data.response_length_trend.length === 0 ? (
            <p className="analytics-empty">Not enough data yet.</p>
          ) : (
            <>
              <div className="analytics-trend-bars">
                {data.response_length_trend.map((t) => (
                  <div
                    key={t.month}
                    className="analytics-trend-bar"
                    style={{ height: `${Math.max(6, (t.avg_words / trendMax) * 100)}%` }}
                    title={`${t.month}: ~${t.avg_words} words / reply`}
                  />
                ))}
              </div>
              <p className="analytics-panel-caption">
                avg {trendWords[trendWords.length - 1] ?? 0} words / reply{trendDirection ? `, ${trendDirection}` : ""}
              </p>
            </>
          )}
        </section>

        <section className="analytics-panel">
          <div className="analytics-panel-title">Conversation depth</div>
          <div className="analytics-depth-headline">
            <strong>{data.avg_messages_per_conversation.toFixed(1)}</strong>
            <span>msgs / convo</span>
          </div>
          <div className="analytics-depth-bars">
            {data.conversation_depth_buckets.map((b) => (
              <div
                key={b.range}
                className={`analytics-depth-bar${b === busiestBucket ? " analytics-depth-bar-peak" : ""}`}
                style={{ height: `${Math.max(6, (b.count / depthMax) * 100)}%` }}
                title={`${b.range} messages: ${b.count} conversations`}
              />
            ))}
          </div>
          <p className="analytics-panel-caption">most threads run {busiestBucket?.range ?? "—"} messages</p>
        </section>
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
    <ModalShell
      title="Move to Project"
      onClose={onClose}
      className="move-project-modal"
      actions={
        <>
          <button onClick={onClose} disabled={moving}>
            Cancel
          </button>
          <button onClick={handleMove} disabled={moving} className="primary">
            {moving ? "Moving..." : "Move"}
          </button>
        </>
      }
    >
      <div className="move-project-summary">
        <p><strong>Conversation:</strong> {conversation.title || "Untitled"}</p>
        <p><strong>Current Project:</strong> {conversation.project?.name || "Uncategorized"}</p>
      </div>

      <div className="form-group">
        <label htmlFor="move-project-select"><strong>Move to:</strong></label>
        <select
          id="move-project-select"
          value={selectedProjectId !== null ? selectedProjectId.toString() : "none"}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedProjectId(val === "none" ? null : parseInt(val, 10));
          }}
        >
          <option value="none">📂 Uncategorized</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              📁 {project.name}
            </option>
          ))}
        </select>
      </div>
    </ModalShell>
  );
}

function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    ["Ctrl/Cmd + K", "Focus search"],
    ["Ctrl/Cmd + I", "Open import"],
    ["Ctrl/Cmd + ,", "Open settings"],
    ["Ctrl/Cmd + E", "Open export menu"],
    ["Ctrl/Cmd + B", "Toggle sidebar"],
    ["Arrow Up / Down", "Navigate conversations"],
    ["Esc", "Close open overlays"],
    ["Shift + ?", "Open keyboard shortcuts"],
  ];

  return (
    <ModalShell title="Keyboard Shortcuts" onClose={onClose} className="shortcut-modal">
      <div className="shortcut-list">
        {shortcuts.map(([keys, description]) => (
          <div key={keys} className="shortcut-row">
            <kbd>{keys}</kbd>
            <span>{description}</span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

