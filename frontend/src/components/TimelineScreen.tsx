import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { API_URL, apiFetch } from "../api";
import { getSourceInfo } from "../utils/conversationPresentation";
import type { Conversation } from "../types";

export type YearMonth = { year: number; month: number }; // month: 0-11

export function currentYearMonth(now = new Date()): YearMonth {
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const index = ym.year * 12 + ym.month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

const monthIndex = (ym: YearMonth) => ym.year * 12 + ym.month;
const pad = (n: number) => String(n).padStart(2, "0");
const firstDay = (ym: YearMonth) => `${ym.year}-${pad(ym.month + 1)}-01`;
const lastDay = (ym: YearMonth) =>
  `${ym.year}-${pad(ym.month + 1)}-${pad(new Date(ym.year, ym.month + 1, 0).getDate())}`;
const monthName = (ym: YearMonth, style: "long" | "short" = "long") =>
  new Date(ym.year, ym.month, 1).toLocaleDateString("en-US", { month: style });

export function formatRange(months: YearMonth[]): string {
  if (months.length === 0) return "";
  const first = months[0];
  const last = months[months.length - 1];
  if (months.length === 1) return `${monthName(last, "short")} ${last.year}`;
  if (first.year === last.year) return `${monthName(first, "short")} – ${monthName(last, "short")} ${last.year}`;
  return `${monthName(first, "short")} ${first.year} – ${monthName(last, "short")} ${last.year}`;
}

const numberFormat = new Intl.NumberFormat("en-US");
const fmt = (value: number | null | undefined) => (typeof value === "number" ? numberFormat.format(value) : "—");

// Under 1100px show 3 months, under 800px 2, under 560px 1.
function monthsForWidth(width: number): number {
  if (width < 560) return 1;
  if (width < 800) return 2;
  if (width < 1100) return 3;
  return 4;
}

function useMonthsVisible(): number {
  const [count, setCount] = useState(() => monthsForWidth(window.innerWidth));
  useEffect(() => {
    const onResize = () => setCount(monthsForWidth(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return count;
}

type Stats = {
  total: number | null;
  chatgpt: number | null;
  claude: number | null;
  thisMonth: number | null;
  filtered: number | null;
  oldest: string | null;
};

type TimelineScreenProps = {
  rangeEnd: YearMonth;
  onRangeEndChange: (next: YearMonth) => void;
  searchQuery: string;
  sourceFilter: string;
  selectedTags: string[];
  selectedProject: number | null;
  projectLabel: string | null;
  refreshKey: number;
  onOpenConversation: (id: number) => void;
  onRemoveTag: (tag: string) => void;
  onClearSource: () => void;
  onClearProject: () => void;
  onClearSearch: () => void;
};

const MAX_PAGES = 30;
const PAGE_SIZE = 100;

function buildFilterParams(
  query: string,
  source: string,
  tags: string[],
  project: number | null,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (source !== "all") params.set("source", source);
  tags.forEach((t) => params.append("tags", t));
  if (project !== null) params.set("project_id", String(project));
  return params;
}

const endpointFor = (params: URLSearchParams) =>
  `${API_URL}/conversations${params.has("q") ? "/search" : ""}?${params}`;

async function fetchTotal(params: URLSearchParams): Promise<number | null> {
  const p = new URLSearchParams(params);
  p.set("page", "1");
  p.set("page_size", "1");
  const response = await apiFetch(endpointFor(p));
  if (!response.ok) return null;
  const data = await response.json();
  return typeof data.total === "number" ? data.total : null;
}

export default function TimelineScreen({
  rangeEnd,
  onRangeEndChange,
  searchQuery,
  sourceFilter,
  selectedTags,
  selectedProject,
  projectLabel,
  refreshKey,
  onOpenConversation,
  onRemoveTag,
  onClearSource,
  onClearProject,
  onClearSearch,
}: TimelineScreenProps) {
  const monthsVisible = useMonthsVisible();
  const nowMonth = currentYearMonth();
  const months = useMemo(
    () => Array.from({ length: monthsVisible }, (_, i) => shiftMonth(rangeEnd, i - (monthsVisible - 1))),
    [rangeEnd.year, rangeEnd.month, monthsVisible],
  );
  const windowStart = months[0];

  // Debounce the shared search query so typing doesn't refetch every keystroke.
  const [query, setQuery] = useState(searchQuery.trim());
  useEffect(() => {
    const handle = window.setTimeout(() => setQuery(searchQuery.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  const tagsKey = selectedTags.join("\u0000");
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [stats, setStats] = useState<Stats>({
    total: null, chatgpt: null, claude: null, thisMonth: null, filtered: null, oldest: null,
  });

  // Archive-wide totals (independent of filters).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsResponse, thisMonth] = await Promise.all([
          apiFetch(`${API_URL}/stats`),
          fetchTotal(new URLSearchParams({ date_from: firstDay(nowMonth), date_to: lastDay(nowMonth) })),
        ]);
        const data = statsResponse.ok ? await statsResponse.json() : null;
        if (cancelled) return;
        setStats((prev) => ({
          ...prev,
          total: data?.total_conversations ?? null,
          chatgpt: data?.sources?.chatgpt ?? (data ? 0 : null),
          claude: data?.sources?.claude ?? (data ? 0 : null),
          oldest: data?.date_range?.oldest ?? null,
          thisMonth,
        }));
      } catch {
        /* stat cells fall back to "—" */
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Count for the active filters across all time.
  useEffect(() => {
    let cancelled = false;
    fetchTotal(buildFilterParams(query, sourceFilter, selectedTags, selectedProject))
      .then((filtered) => { if (!cancelled) setStats((prev) => ({ ...prev, filtered })); })
      .catch(() => { if (!cancelled) setStats((prev) => ({ ...prev, filtered: null })); });
    return () => { cancelled = true; };
  }, [query, sourceFilter, tagsKey, selectedProject, refreshKey]);

  // Conversations inside the visible window, paged until complete.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const base = buildFilterParams(query, sourceFilter, selectedTags, selectedProject);
        base.set("date_from", firstDay(windowStart));
        base.set("date_to", lastDay(rangeEnd));
        base.set("page_size", String(PAGE_SIZE));
        if (!query) {
          base.set("sort_by", "created_at");
          base.set("sort_order", "desc");
        }
        const collected: Conversation[] = [];
        for (let page = 1; page <= MAX_PAGES; page += 1) {
          base.set("page", String(page));
          const response = await apiFetch(endpointFor(base));
          if (!response.ok) throw new Error("Couldn't load the timeline.");
          const data = await response.json();
          collected.push(...(data.items || []));
          if (!data.pages || page >= data.pages) break;
        }
        if (!cancelled) setItems(collected);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load the timeline.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query, sourceFilter, tagsKey, selectedProject, windowStart.year, windowStart.month, rangeEnd.year, rangeEnd.month, refreshKey, retryKey]);

  // The backend date filter is on created_at, so group on the same field.
  const byMonth = useMemo(() => {
    const groups = new Map<number, Conversation[]>();
    for (const conv of items) {
      if (!conv.created_at) continue;
      const date = new Date(conv.created_at);
      const key = date.getFullYear() * 12 + date.getMonth();
      const list = groups.get(key) ?? [];
      list.push(conv);
      groups.set(key, list);
    }
    groups.forEach((list) =>
      list.sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()),
    );
    return groups;
  }, [items]);

  const spansYears = months[0].year !== months[months.length - 1].year;
  const atNewest = monthIndex(rangeEnd) >= monthIndex(nowMonth);
  const oldestIndex = stats.oldest
    ? (() => { const d = new Date(stats.oldest); return d.getFullYear() * 12 + d.getMonth(); })()
    : null;
  const atOldest = oldestIndex !== null && monthIndex(windowStart) <= oldestIndex;

  const filterLabel = selectedTags.length > 0 ? `Tagged ${selectedTags.join(" + ")}` : "Filtered";
  const sourceName = sourceFilter !== "all" ? getSourceInfo(sourceFilter).name : null;
  const trimmedSearch = searchQuery.trim();
  const hasChips = selectedTags.length > 0 || sourceName || projectLabel || trimmedSearch;

  return (
    <section className="timeline-screen" aria-label="Timeline">
      <div className="timeline-stats">
        <div className="timeline-stat">
          <span className="timeline-stat-label">Conversations</span>
          <strong className="timeline-stat-value">{fmt(stats.total)}</strong>
        </div>
        <div className="timeline-stat">
          <span className="timeline-stat-label">{filterLabel}</span>
          <strong className="timeline-stat-value timeline-stat-accent">{fmt(stats.filtered)}</strong>
        </div>
        <div className="timeline-stat">
          <span className="timeline-stat-label">ChatGPT</span>
          <strong className="timeline-stat-value">{fmt(stats.chatgpt)}</strong>
        </div>
        <div className="timeline-stat">
          <span className="timeline-stat-label">Claude</span>
          <strong className="timeline-stat-value">{fmt(stats.claude)}</strong>
        </div>
        <div className="timeline-stat">
          <span className="timeline-stat-label">This month</span>
          <strong className="timeline-stat-value">{fmt(stats.thisMonth)}</strong>
        </div>
      </div>

      <div className="timeline-bar">
        <div className="timeline-chips" aria-label="Active filters">
          {selectedTags.map((tag) => (
            <button key={tag} type="button" className="timeline-chip" onClick={() => onRemoveTag(tag)} aria-label={`Remove tag filter ${tag}`}>
              {tag} <X size={11} aria-hidden="true" />
            </button>
          ))}
          {sourceName && (
            <button type="button" className="timeline-chip" onClick={onClearSource} aria-label={`Remove source filter ${sourceName}`}>
              {sourceName} <X size={11} aria-hidden="true" />
            </button>
          )}
          {projectLabel && (
            <button type="button" className="timeline-chip" onClick={onClearProject} aria-label={`Remove project filter ${projectLabel}`}>
              {projectLabel} <X size={11} aria-hidden="true" />
            </button>
          )}
          {trimmedSearch && (
            <button type="button" className="timeline-chip" onClick={onClearSearch} aria-label="Clear search">
              “{trimmedSearch}” <X size={11} aria-hidden="true" />
            </button>
          )}
          {!hasChips && <span className="timeline-chips-empty">All conversations</span>}
        </div>
        <div className="timeline-pager">
          <button
            type="button"
            className="timeline-pager-btn"
            onClick={() => onRangeEndChange(shiftMonth(rangeEnd, -1))}
            disabled={atOldest}
            aria-label="Earlier month"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="timeline-pager-label" aria-live="polite">{formatRange(months)}</span>
          <button
            type="button"
            className="timeline-pager-btn"
            onClick={() => onRangeEndChange(shiftMonth(rangeEnd, 1))}
            disabled={atNewest}
            aria-label="Later month"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div className="timeline-grid" style={{ gridTemplateColumns: `repeat(${monthsVisible}, minmax(0, 1fr))` }} aria-busy={loading}>
        {months.map((ym) => {
          const key = monthIndex(ym);
          const rows = byMonth.get(key) ?? [];
          const isCurrent = key === monthIndex(nowMonth);
          return (
            <div key={key} className="timeline-col">
              <div className={`timeline-col-head${isCurrent ? " current" : ""}`}>
                <h3 className="timeline-col-month">
                  {monthName(ym)}{spansYears ? ` ${ym.year}` : ""}
                </h3>
                <span className="timeline-col-count">{loading || error ? "" : rows.length}</span>
              </div>
              <div className="timeline-col-body">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="timeline-row-skeleton" aria-hidden="true">
                      <span /><span />
                    </div>
                  ))
                ) : error ? null : rows.length === 0 ? (
                  <p className="timeline-empty">No conversations</p>
                ) : (
                  rows.map((conv) => {
                    const day = conv.created_at ? pad(new Date(conv.created_at).getDate()) : "--";
                    return (
                      <button
                        key={conv.id}
                        type="button"
                        className="timeline-row"
                        onClick={() => onOpenConversation(conv.id)}
                      >
                        <span className="timeline-row-day">{day}</span>
                        <span className="timeline-row-main">
                          <span className="timeline-row-title">{conv.title || "Untitled conversation"}</span>
                          <span className="timeline-row-meta" data-source={conv.source}>
                            {getSourceInfo(conv.source).name} · {conv.message_count} msgs
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
        {error && !loading && (
          <div className="timeline-error" role="alert">
            <span>{error}</span>
            <button type="button" className="timeline-retry" onClick={() => setRetryKey((k) => k + 1)}>Retry</button>
          </div>
        )}
      </div>
    </section>
  );
}
