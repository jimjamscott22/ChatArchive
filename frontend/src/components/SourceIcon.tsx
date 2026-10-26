import { Bot, Code2, FileText, MessageSquare, Sparkles } from "lucide-react";

const ICONS = {
  chatgpt: MessageSquare,
  claude: Bot,
  gemini: Sparkles,
  copilot: Code2,
} as const;

export default function SourceIcon({ source, size = 16 }: { source: string; size?: number }) {
  const Icon = ICONS[source as keyof typeof ICONS] ?? FileText;
  return <Icon size={size} aria-hidden="true" />;
}
