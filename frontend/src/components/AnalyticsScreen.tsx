import React, { useState, useEffect } from "react";
import { Sun } from "lucide-react";
import ModalShell from "./ModalShell";
import { API_URL, apiFetch, apiErrorMessage } from "../api";
import type { Conversation, AnalyticsData } from "../types";

export default function AnalyticsScreen({ range }: { range: "30d" | "all" }) {
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
