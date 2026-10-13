import React, { useState, useEffect, useRef, lazy } from "react";
import { Sparkles, Upload, Search, Menu, Sun, Moon, MoreVertical, Trash2, Download, Tag, Settings, Copy, Database, ExternalLink, ChevronLeft, ChevronRight, Maximize2, Minimize2, BarChart2, Palette, Home } from "lucide-react";
import LazyFeature from "./components/LazyFeature";
import useActionFeedback from "./components/useActionFeedback";
import AuthGate from "./components/AuthGate";
import { formatDateTime, getSourceInfo, orderMessages, type Message } from "./utils/conversationPresentation";
import { renderHighlightedText } from "./utils/searchHighlight";
import { API_URL, apiFetch, apiErrorMessage, getToken, setUnauthorizedHandler } from "./api";

import type { Conversation, ConversationDetail, TagType, ProjectType } from "./types";

const ConversationReader = lazy(() => import("./components/ConversationReader"));
const TagManagerModal = lazy(() => import("./components/TagManagerModal"));
const ImportModal = lazy(() => import("./components/ImportModal"));
const SettingsModal = lazy(() => import("./components/SettingsModal"));
const DuplicatesModal = lazy(() => import("./components/DuplicatesModal"));
const ProjectManagerModal = lazy(() => import("./components/ProjectManagerModal"));
const AnalyticsScreen = lazy(() => import("./components/AnalyticsScreen"));
const MoveToProjectModal = lazy(() => import("./components/MoveToProjectModal"));
const KeyboardShortcutsModal = lazy(() => import("./components/KeyboardShortcutsModal"));

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

const THEMES: { id: ThemeId; label: string; mood: string; swatch: string }[] = [
  { id: 'dark', label: 'Dark', mood: 'Brass noir', swatch: 'linear-gradient(135deg, #17130f 0 38%, #44331f 38% 72%, #d6a65b 72%)' },
  { id: 'light', label: 'Light', mood: 'Sunlit paper', swatch: 'linear-gradient(135deg, #fffaf0 0 38%, #e6d1aa 38% 72%, #8b4513 72%)' },
  { id: 'sepia', label: 'Sepia', mood: 'Old manuscript', swatch: 'linear-gradient(135deg, #f4e5c6 0 38%, #cda66c 38% 72%, #7d3e12 72%)' },
  { id: 'coffee', label: 'Coffee', mood: 'Roasted velvet', swatch: 'linear-gradient(135deg, #170b06 0 38%, #5c351d 38% 72%, #e4aa69 72%)' },
  { id: 'rose', label: 'Rose', mood: 'Powdered lacquer', swatch: 'linear-gradient(135deg, #fff0ed 0 38%, #dda6aa 38% 72%, #922b50 72%)' },
  { id: 'sunset', label: 'Sunset', mood: 'Ember horizon', swatch: 'linear-gradient(135deg, #1d0909 0 38%, #9c3d21 38% 72%, #ffc06f 72%)' },
  { id: 'nord', label: 'Nord', mood: 'Polar glass', swatch: 'linear-gradient(135deg, #1d2430 0 38%, #4f6275 38% 72%, #9ce2eb 72%)' },
  { id: 'dracula', label: 'Dracula', mood: 'Ultraviolet ink', swatch: 'linear-gradient(135deg, #181820 0 38%, #514568 38% 72%, #c7a0ff 72%)' },
  { id: 'solarized-dark', label: 'Solarized', mood: 'Electric cyan', swatch: 'linear-gradient(135deg, #001b21 0 38%, #075365 38% 72%, #35aaf4 72%)' },
  { id: 'ocean', label: 'Ocean', mood: 'Midnight tide', swatch: 'linear-gradient(135deg, #031326 0 38%, #0d5d86 38% 72%, #43d4ff 72%)' },
  { id: 'forest', label: 'Forest', mood: 'Moss & pine', swatch: 'linear-gradient(135deg, #101a12 0 38%, #3f6040 38% 72%, #a8d880 72%)' },
];

const THEME_STORAGE_KEY = 'chatarchive-theme';

// Check if we're in standalone conversation view (opened in new window)
function getInitialConversationId(): number | null {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("conversation");
  if (!id) return null;
  const parsed = Number.parseInt(id, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function App() {
  const { notify, confirmAction, feedback } = useActionFeedback(true);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [authorized, setAuthorized] = useState(() => !!getToken());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasListResponse, setHasListResponse] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [listTotal, setListTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [standaloneMode, setStandaloneMode] = useState(() => getInitialConversationId() !== null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const detailRequestId = useRef(0);
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
  const paletteTriggerRef = useRef<HTMLButtonElement>(null);
  const paletteMenuRef = useRef<HTMLDivElement>(null);

  const dismissPalette = (restoreFocus = true) => {
    setPaletteOpen(false);
    if (restoreFocus) paletteTriggerRef.current?.focus();
  };

  useEffect(() => {
    if (paletteOpen) {
      paletteMenuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    }
  }, [paletteOpen]);
  const [showMenu, setShowMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('chatarchive-sidebar-width');
      const parsed = saved ? Number(saved) : null;
      return parsed && parsed >= 200 && parsed <= 420 ? parsed : 268;
    } catch { /* ignore */ }
    return 268;
  });
  const [sidebarPosition, setSidebarPosition] = useState<'left' | 'right'>(() => {
    try {
      const saved = localStorage.getItem('chatarchive-sidebar-position');
      if (saved === 'left' || saved === 'right') return saved;
    } catch { /* ignore */ }
    return 'left';
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizingRef = useRef(false);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
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
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const listRequestId = useRef(0);
  const searchDebounceRef = useRef<number | null>(null);
  const selectedConversationTitle = selectedConversation?.title || conversations.find(conv => conv.id === selectedConversationId)?.title;
  const currentThemeLabel = THEMES.find(t => t.id === theme)?.label ?? 'Dark';

  useEffect(() => {
    setUnauthorizedHandler(() => { clearConversation(); setAuthorized(false); });
    return () => { detailRequestId.current += 1; };
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
      if (e.defaultPrevented || paletteOpen || document.querySelector("dialog[open]")) return;
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

      const modalOpen =
        showImportModal ||
        showSettingsModal ||
        showDuplicatesModal ||
        showTagModal ||
        showProjectModal ||
        showMoveToProjectModal ||
        showShortcutsModal;

      // Escape: Close modals first; don't also dismiss analytics behind them
      if (e.key === 'Escape') {
        setShowImportModal(false);
        setShowSettingsModal(false);
        setShowDuplicatesModal(false);
        setShowTagModal(false);
        setShowProjectModal(false);
        setShowMoveToProjectModal(false);
        setShowShortcutsModal(false);
        setShowMenu(false);
        setShowAddTag(false);
        if (!modalOpen) {
          setAnalyticsView(false);
        }
        return;
      }

      if (modalOpen) {
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
  }, [paletteOpen, conversations, selectedConversation, showMenu, sidebarCollapsed, showImportModal, showSettingsModal, showDuplicatesModal, showTagModal, showProjectModal, showMoveToProjectModal, showShortcutsModal]);

  // Sidebar resize handlers
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
  };

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizingRef.current) return;
      if (e.buttons === 0) { onUp(); return; }
      const raw = sidebarPosition === 'left' ? e.clientX : window.innerWidth - e.clientX;
      const next = Math.min(420, Math.max(200, raw));
      setSidebarWidth(next);
    }
    function onUp() {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      try {
        localStorage.setItem('chatarchive-sidebar-width', String(sidebarWidth));
      } catch { /* ignore */ }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [sidebarPosition, sidebarWidth]);

  const toggleSidebarPosition = () => {
    const next = sidebarPosition === 'left' ? 'right' : 'left';
    setSidebarPosition(next);
    try {
      localStorage.setItem('chatarchive-sidebar-position', next);
    } catch { /* ignore */ }
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const applyListResponse = (
    requestId: number,
    data: { items?: Conversation[]; page?: number; pages?: number; total?: number },
    page: number,
    reload: (nextPage: number) => void,
  ) => {
    if (requestId !== listRequestId.current) return;
    const items = data.items || [];
    const pages = data.pages ?? 0;
    if (items.length === 0 && page > 1 && (pages === 0 || page > pages)) {
      reload(Math.max(1, pages || page - 1));
      return;
    }
    setListError(null);
    setConversations(items);
    setHasListResponse(true);
    setCurrentPage(data.page ?? page);
    setTotalPages(pages);
    setListTotal(typeof data.total === "number" ? data.total : items.length);
    setLoading(false);
    setIsSearching(false);
  };

  const loadConversations = async (source?: string, page = 1, tag?: string | null, projectId?: number | null, activeTags?: string[], from?: string, to?: string, sbBy?: string, sbOrder?: string) => {
    const requestId = ++listRequestId.current;
    try {
      setLoading(true);
      setListError(null);
      const params = new URLSearchParams({
        page_size: PAGE_SIZE.toString(),
        page: page.toString(),
      });
      if (source && source !== "all") {
        params.append("source", source);
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
      if (requestId !== listRequestId.current) return;
      if (!response.ok) {
        setListError("Couldn't load conversations. Please try again.");
        setLoading(false);
        setIsSearching(false);
        return;
      }
      const data = await response.json();
      applyListResponse(requestId, data, page, (nextPage) => {
        loadConversations(source, nextPage, tag, projectId, activeTags, from, to, sbBy, sbOrder);
      });
    } catch (error) {
      if (requestId !== listRequestId.current) return;
      console.error("Failed to load conversations:", error);
      setListError("Couldn't load conversations. Please try again.");
      setLoading(false);
      setIsSearching(false);
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
    const requestId = ++listRequestId.current;
    try {
      setLoading(true);
      setIsSearching(true);
      setListError(null);
      const params = new URLSearchParams({
        q: query,
        page_size: PAGE_SIZE.toString(),
        page: page.toString(),
      });
      if (source && source !== "all") {
        params.append("source", source);
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
      if (requestId !== listRequestId.current) return;
      if (!response.ok) {
        setListError("Search failed. Please try again.");
        setLoading(false);
        setIsSearching(false);
        return;
      }
      const data = await response.json();
      applyListResponse(requestId, data, page, (nextPage) => {
        loadSearchResults(query, nextPage, source, tag, projectId, activeTags, from, to);
      });
    } catch (error) {
      if (requestId !== listRequestId.current) return;
      console.error("Search failed:", error);
      setListError("Search failed. Please try again.");
      setLoading(false);
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

  const clearConversation = () => {
    // Invalidate pending detail requests when leaving the reader.
    detailRequestId.current += 1;
    setSelectedConversationId(null);
    setSelectedConversation(null);
    setDetailLoading(false);
    setDetailError(null);
  };

  const loadConversation = async (id: number) => {
    const requestId = ++detailRequestId.current;
    setSelectedConversationId(id);
    setSelectedConversation(null);
    setDetailLoading(true);
    setDetailError(null);
    setAnalyticsView(false);
    try {
      const response = await apiFetch(`${API_URL}/conversations/${id}`);
      if (requestId !== detailRequestId.current) return;
      if (!response.ok) {
        setDetailError(response.status === 404
          ? "Conversation not found. It may have been deleted."
          : "Couldn't load conversation. Please try again.");
        return;
      }
      const data: ConversationDetail = await response.json();
      if (requestId !== detailRequestId.current) return;
      if (!data || data.id !== id || !Array.isArray(data.messages)) {
        setDetailError("Conversation could not be loaded. Please try again.");
        return;
      }
      setSelectedConversation(data);
    } catch {
      if (requestId !== detailRequestId.current) return;
      setDetailError("Couldn't load conversation. Please try again.");
    } finally {
      if (requestId === detailRequestId.current) setDetailLoading(false);
    }
  };

  const openConversationInNewWindow = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?conversation=${id}`;
    window.open(url, "_blank", "noopener,noreferrer,width=900,height=700");
  };

  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (query: string) => {
    // Invalidate immediately, including the debounce window.
    listRequestId.current += 1;
    setLoading(true);
    setListError(null);
    setSearchQuery(query);
    setCurrentPage(1);
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = window.setTimeout(() => {
      if (!query.trim()) {
        setIsSearching(false);
        loadConversations(sourceFilter, 1, null, selectedProject, selectedTags);
        return;
      }
      loadSearchResults(query.trim(), 1, sourceFilter, null, selectedProject, selectedTags);
    }, 200);
  };

  // Tag-related functions
  const loadTags = async () => {
    try {
      const response = await apiFetch(`${API_URL}/tags`);
      const data = await response.json();
      const tags = data.items || [];
      setAllTags(tags);
      setSelectedTags((prev) => prev.filter((name) => tags.some((tag: TagType) => tag.name === name)));
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
    const next = tagName ? [tagName] : [];
    setSelectedTag(null);
    setSelectedTags(next);
    setCurrentPage(1);
    refreshConversationList(1, undefined, null, selectedProject, next);
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
    setSelectedTag(null);
    setCurrentPage(1);
    refreshConversationList(1, undefined, null, selectedProject, next);
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
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
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
    loadConversations("all", 1, null, null, [], "", "", "created_at", "desc");
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
      
      await loadTags();
      refreshConversationList(currentPage);
      if (selectedConversation) {
        await loadConversation(selectedConversation.id);
      }
      
      notify(`Tagged ${result.tagged_count} conversations.`);
    } catch (error) {
      console.error("Failed to auto-tag conversations:", error);
      notify("Failed to auto-tag conversations. Please try again.", "error", autoTagAllConversations);
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
      notify("Tag removed from conversation.");
    } catch (error) {
      console.error("Failed to remove tag:", error);
      notify("Failed to remove tag. Please try again.", "error", () => removeTagFromConversation(conversationId, tagId));
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
        throw new Error(apiErrorMessage(error, 'Failed to create project'));
      }
      
      await loadProjects();
      return true;
    } catch (error) {
      console.error("Failed to create project:", error);
      notify(error instanceof Error ? error.message : 'Failed to create project. Please try again.', 'error');
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
      notify(projectId === null ? "Conversation moved to Uncategorized." : "Conversation moved to the selected project.");
      setShowMoveToProjectModal(false);
    } catch (error) {
      console.error("Failed to move conversation:", error);
      throw new Error('Failed to move conversation to project. Please try again.');
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

  const handleSourceFilter = (source: string) => {
    setSourceFilter(source);
    setCurrentPage(1);
    if (searchQuery.trim()) {
      loadSearchResults(searchQuery.trim(), 1, source, selectedTag, selectedProject);
      return;
    }
    loadConversations(source, 1, null, selectedProject, selectedTags);
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation || deletingConversation) return;
    const conversation = selectedConversation;
    if (!await confirmAction(`Delete "${conversation.title || "Untitled conversation"}" and all its messages? This cannot be undone.`, "Delete conversation", "Delete conversation")) return;
    const requestId = detailRequestId.current;
    setDeletingConversation(true);
    try {
      const response = await apiFetch(`${API_URL}/conversations/${conversation.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete conversation. Please try again.');
      if (requestId === detailRequestId.current) clearConversation();
      const nextPage = conversations.length <= 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      refreshConversationList(nextPage);
      setShowMenu(false);
      notify(`Deleted "${conversation.title || "Untitled conversation"}".`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to delete conversation. Please try again.', "error", handleDeleteConversation);
    } finally {
      setDeletingConversation(false);
    }
  };

  const addTagToConversation = async (conversationId: number, tagName: string) => {
    const trimmed = tagName.trim();
    if (!trimmed) return;
    try {
      const response = await apiFetch(`${API_URL}/conversations/${conversationId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_name: trimmed }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(apiErrorMessage(errorData, 'Failed to add tag'));
      }
      notify(`Tag "${trimmed}" added to conversation.`);
      setNewTagName("");
      setShowAddTag(false);
      await loadTags();
      await loadConversation(conversationId);
      refreshConversationList(currentPage);
    } catch (error) {
      console.error("Failed to add tag:", error);
      notify(error instanceof Error ? error.message : "Failed to add tag. Please try again.", "error", () => addTagToConversation(conversationId, trimmed));
    }
  };

  const sanitizeFilename = (value: string): string => {
    return value
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
  };

  const getOrderedMessages = (conversation: ConversationDetail): Message[] => {
    return orderMessages(conversation.messages);
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

    const exportWindow = window.open("", "_blank");
    if (!exportWindow) {
      notify("Unable to open the export window. Allow popups, then try again.", "error", handleExportPdf);
      return;
    }

    exportWindow.document.open();
    exportWindow.document.write(buildHtmlExport(selectedConversation));
    exportWindow.document.close();
    exportWindow.focus();

    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
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
  const uncategorizedCount = Math.max(
    0,
    listTotal - allProjects.reduce((sum, project) => sum + (project.conversation_count || 0), 0)
  );
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
    ...selectedTags
      .filter((t) => t !== selectedTag)
      .map(t => `Tag: ${t}`),
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
          <h1 className="standalone-title">{selectedConversationTitle || (detailError ? "Conversation unavailable" : "Loading...")}</h1>
          <a
            href={window.location.pathname}
            target="_self"
            className="icon-btn back-link"
            title="Back to ChatArchive"
          >
            ← Back to ChatArchive
          </a>
        </div>
        <div className="standalone-content" aria-busy={detailLoading}>
          {detailError ? (
            <div className="welcome-state">
              <p role="alert">{detailError}</p>
              <button className="empty-action-btn" onClick={() => selectedConversationId !== null && loadConversation(selectedConversationId)}>Retry</button>
            </div>
          ) : selectedConversation ? (
            <LazyFeature label="conversation reader" reader>
              <ConversationReader
                conversationId={selectedConversation.id}
                source={selectedConversation.source}
                messages={selectedConversation.messages}
                highlightQuery={highlightQuery}
              />
            </LazyFeature>
          ) : (
            <div className="welcome-state">
              <p role="status">Loading conversation...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container${fullWidthConvo && selectedConversationId !== null ? ' sidebar-hidden' : ''}${sidebarPosition === 'right' ? ' sidebar-right' : ''}`}>
      {feedback}
      <div className="theme-transition-wash" key={theme} aria-hidden="true" />
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}${isResizing ? ' resizing' : ''}`} style={!sidebarCollapsed ? { '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties : undefined}>
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
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </div>

        <div className="sidebar-scroll-area">
          {!sidebarCollapsed && (
            <div className="sidebar-top">
              <button
                className={`sidebar-home-btn${!analyticsView && selectedConversationId === null ? " active" : ""}`}
                onClick={() => { setAnalyticsView(false); clearConversation(); }}
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
                  <span className="sidebar-panel-meta">
                    {listTotal > conversations.length
                      ? `${conversations.length} of ${listTotal}`
                      : `${listTotal || conversations.length} shown`}
                  </span>
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
                    onClick={() => { setAnalyticsView(true); clearConversation(); }}
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

          {hasListResponse && (loading || isSearching) && (
            <p className="list-update-status" role="status">Updating results…</p>
          )}
          {hasListResponse && listError && (
            <div className="list-update-error" role="alert">
              <p>{listError} Previous results are still shown.</p>
              <button onClick={() => refreshConversationList(currentPage)}>Try again</button>
            </div>
          )}
          <div className="conversations-list sidebar-list" aria-label="Conversation list in sidebar" aria-busy={loading || isSearching}
            onKeyDown={(e) => {
              const target = e.target;
              if (!(target instanceof HTMLElement) || !target.matches('.conversation-card')) return;
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              e.preventDefault();
              const cards = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('.conversation-card'));
              const index = cards.indexOf(target);
              const next = Math.max(0, Math.min(cards.length - 1, index + (e.key === "ArrowDown" ? 1 : -1)));
              cards[next]?.focus();
              if (conversations[next]) loadConversation(conversations[next].id);
            }}>
            {(loading || isSearching) && !hasListResponse ? (
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
            ) : listError && !hasListResponse ? (
              <div className="empty-state">
                <div className="empty-icon">⚠️</div>
                <h3>Couldn't load conversations</h3>
                <p>{listError}</p>
                <button className="empty-action-btn" onClick={() => refreshConversationList(currentPage)}>
                  Try again
                </button>
              </div>
            ) : conversations.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💬</div>
                <h3>{hasActiveFilters ? "No matching conversations" : "No conversations yet"}</h3>
                <p>
                  {hasActiveFilters
                    ? "Try clearing a filter or broadening your search."
                    : "Import your first conversation to get started"}
                </p>
                {hasActiveFilters ? (
                  <button className="empty-action-btn" onClick={clearAllFilters}>
                    Clear filters
                  </button>
                ) : (
                <button className="empty-action-btn" onClick={() => setShowImportModal(true)}>
                  <Upload size={16} />
                  Import Conversations
                </button>
                )}
              </div>
            ) : (
              (() => {
                let lastGroup = "";
                return conversations.map((conv) => {
                  const group = (sortBy === "created_at" || sortBy === "updated_at")
                    ? getDateGroupLabel(conv.updated_at || conv.created_at)
                    : "";
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
                  className={`conversation-card ${selectedConversationId === conv.id ? "active" : ""} ${draggedConversationId === conv.id ? "dragging" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedConversationId === conv.id}
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

          {totalPages > 1 && (
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

        {/* Sidebar resize handle */}
        <div
          className="sidebar-resize-handle"
          onMouseDown={startResize}
          title="Drag to resize"
        />

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
      <main className="main-content" aria-busy={!selectedConversationId && !analyticsView && (loading || isSearching)}>
        <header className="main-header">
          <div className="main-header-top">
            <div className="main-header-leading">
              <button className="icon-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title="Toggle sidebar">
                <Menu size={20} />
              </button>
              <button className="icon-btn" onClick={toggleSidebarPosition} title="Move sidebar to other side">
                {sidebarPosition === 'left' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
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
                  : selectedConversationTitle || (selectedConversationId !== null ? "Opening conversation" : "Browse and organize your conversations")}
              </h2>
              {selectedConversationId === null && !analyticsView && (
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
                    onClick={handleDeleteConversation} disabled={deletingConversation}
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
                    <button className="menu-item" onClick={handleDeleteConversation} disabled={deletingConversation}>
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
                    <button
                      className="menu-item"
                      onClick={() => {
                        setShowAddTag(true);
                        setShowMenu(false);
                      }}
                    >
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

              {(selectedConversation.tags && selectedConversation.tags.length > 0) || showAddTag ? (
                <div className="conversation-tags-header">
                  {selectedConversation.tags?.map((tag) => (
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
                        aria-label={`Remove tag ${tag.name}`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (await confirmAction(`Remove tag "${tag.name}" from this conversation?`, "Remove tag", "Remove tag")) {
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
                  {showAddTag && (
                    <form
                      className="add-tag-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        addTagToConversation(selectedConversation.id, newTagName);
                      }}
                    >
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Tag name"
                        autoFocus
                        list="existing-tags"
                        aria-label="New tag name"
                      />
                      <datalist id="existing-tags">
                        {allTags
                          .filter((tag) => !selectedConversation.tags?.some((assigned) => assigned.id === tag.id))
                          .map((tag) => (
                            <option key={tag.id} value={tag.name} />
                          ))}
                      </datalist>
                      <button type="submit" className="add-tag-submit">Add</button>
                      <button type="button" onClick={() => { setShowAddTag(false); setNewTagName(""); }}>Cancel</button>
                    </form>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </header>

        <div className="content-area content-area-scrollable" aria-busy={detailLoading}>
          {analyticsView ? (
            <LazyFeature label="analytics"><AnalyticsScreen range={analyticsRange} /></LazyFeature>
          ) : detailLoading || detailError ? (
            <div className="welcome-state">
              {detailLoading ? <p role="status">Loading conversation...</p> : <>
                <p role="alert">{detailError}</p>
                <button className="empty-action-btn" onClick={() => selectedConversationId !== null && loadConversation(selectedConversationId)}>Retry</button>
              </>}
            </div>
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

              {(loading || isSearching) && !hasListResponse ? (
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
                      <strong>{listTotal || conversations.length}</strong>
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
            <LazyFeature label="conversation reader" reader>
              <ConversationReader
                conversationId={selectedConversation.id}
                source={selectedConversation.source}
                messages={selectedConversation.messages}
                highlightQuery={highlightQuery}
              />
            </LazyFeature>
          )}
        </div>
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <LazyFeature label="Import Conversations" onClose={() => setShowImportModal(false)}>
          <ImportModal
            onClose={() => setShowImportModal(false)}
            onSuccess={() => {
              loadTags();
              loadProjects();
              refreshConversationList(1);
            }}
          />
        </LazyFeature>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <LazyFeature label="Import & Export Settings" onClose={() => setShowSettingsModal(false)}>
          <SettingsModal
            onClose={() => setShowSettingsModal(false)}
            onConversationsChanged={() => {
              clearConversation();
              loadTags();
              loadProjects();
              refreshConversationList(1);
            }}
          />
        </LazyFeature>
      )}

      {showDuplicatesModal && (
        <LazyFeature label="Duplicate Management" onClose={() => setShowDuplicatesModal(false)}>
          <DuplicatesModal
            onClose={() => setShowDuplicatesModal(false)}
            onSuccess={() => refreshConversationList()}
          />
        </LazyFeature>
      )}

      {showTagModal && (
        <LazyFeature label="Manage Tags" onClose={() => setShowTagModal(false)}>
          <TagManagerModal
            tags={allTags}
            onClose={() => setShowTagModal(false)}
            onTagsUpdated={() => {
              loadTags();
              refreshConversationList(currentPage);
              if (selectedConversation) loadConversation(selectedConversation.id);
            }}
          />
        </LazyFeature>
      )}

      {showProjectModal && (
        <LazyFeature label="Manage Projects" onClose={() => setShowProjectModal(false)}>
          <ProjectManagerModal
            projects={allProjects}
            onClose={() => setShowProjectModal(false)}
            onProjectsUpdated={() => {
              loadProjects();
              refreshConversationList(currentPage);
              if (selectedConversation) loadConversation(selectedConversation.id);
            }}
          />
        </LazyFeature>
      )}

      {showMoveToProjectModal && selectedConversation && (
        <LazyFeature label="Move to Project" onClose={() => setShowMoveToProjectModal(false)}>
          <MoveToProjectModal
            conversation={selectedConversation}
            projects={allProjects}
            onClose={() => setShowMoveToProjectModal(false)}
            onMove={moveConversationToProject}
          />
        </LazyFeature>
      )}

      {showShortcutsModal && (
        <LazyFeature label="Keyboard Shortcuts" onClose={() => setShowShortcutsModal(false)}>
          <KeyboardShortcutsModal onClose={() => setShowShortcutsModal(false)} />
        </LazyFeature>
      )}

      <div className="theme-palette-wrapper">
        <button
          ref={paletteTriggerRef}
          className="theme-palette-btn"
          aria-haspopup="menu"
          aria-controls={paletteOpen ? "theme-palette-menu" : undefined}
          onClick={() => paletteOpen ? dismissPalette() : setPaletteOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setPaletteOpen(true);
            }
          }}
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
              data-testid="theme-palette-backdrop"
              onClick={() => dismissPalette()}
            />
            <div
              ref={paletteMenuRef}
              id="theme-palette-menu"
              className="theme-palette-menu"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  dismissPalette();
                } else if (e.key === "Tab") {
                  dismissPalette(false);
                } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                  e.preventDefault();
                  const options = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
                  const index = options.findIndex(option => option === document.activeElement);
                  const next = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1
                    : (index + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
                  options[next]?.focus();
                }
              }}
              role="menu"
              aria-label="Theme palette"
              style={{ zIndex: 501 }}
            >
              <div className="theme-palette-heading" role="presentation">
                <span>Archive atmosphere</span>
                <strong>{currentThemeLabel}</strong>
              </div>
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={`theme-option ${theme === t.id ? 'active' : ''}`}
                  onClick={() => { setTheme(t.id); dismissPalette(); }}
                  tabIndex={-1}
                  role="menuitemradio"
                  aria-label={t.label}
                  aria-checked={theme === t.id}
                >
                  <span className="theme-swatch" style={{ background: t.swatch }} />
                  <span className="theme-option-copy">
                    <span className="theme-option-name">{t.label}</span>
                    <span className="theme-option-mood">{t.mood}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
