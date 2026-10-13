export type Message = {
  id: number;
  role: string;
  content: string;
  created_at?: string | null;
  order_index: number;
};

export const formatDateTime = (dateStr: string | null | undefined): string => {
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

const SOURCE_INFO: Record<string, { icon: string; name: string; color: string }> = {
  chatgpt: { icon: '💬', name: 'ChatGPT', color: 'var(--chatgpt-color)' },
  claude: { icon: '🤖', name: 'Claude', color: 'var(--claude-color)' },
  gemini: { icon: '✨', name: 'Gemini', color: 'var(--gemini-color)' },
  copilot: { icon: '👨‍💻', name: 'Copilot', color: 'var(--copilot-color)' },
};

export const getSourceInfo = (source: string) =>
  SOURCE_INFO[source] || { icon: '📝', name: source, color: 'var(--accent)' };

export const orderMessages = (messages: readonly Message[]): Message[] =>
  [...messages].sort((a, b) => a.order_index - b.order_index);
