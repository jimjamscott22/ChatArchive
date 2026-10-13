import type { Message } from "./utils/conversationPresentation";

export type Conversation = {
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

export type TagType = {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at: string;
  conversation_count: number;
};

export type ProjectType = {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at: string;
  conversation_count: number;
};

export type ConversationDetail = Conversation & {
  messages: Message[];
};

export type ImportHistory = {
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

export type ImportSettings = {
  id: number;
  allowed_formats: string;
  default_format: string;
  auto_merge_duplicates: boolean;
  keep_separate: boolean;
  skip_empty_conversations: boolean;
  updated_at: string;
};

export type BundleImportResult = {
  import_history_id: number;
  status: "success" | "partial";
  conversations: { imported: number; updated: number; skipped: number };
  projects: { created: number; matched: number };
  resources: {
    stored: number;
    inline: number;
    metadata_only: number;
    unavailable: number;
  };
  warnings: {
    code: string;
    message: string;
    entry?: string | null;
  }[];
};

export type DuplicateConversation = {
  id: number;
  source: string;
  source_id: string | null;
  title: string | null;
  created_at: string | null;
  updated_at: string | null;
  message_count: number;
};

export type DuplicateGroup = {
  key: string;
  source: string;
  source_id: string | null;
  title: string | null;
  count: number;
  conversations: DuplicateConversation[];
  total_messages: number;
};

export type AnalyticsData = {
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

export type DuplicatesData = {
  groups: DuplicateGroup[];
  total_duplicates: number;
  total_groups: number;
  strategy: string;
};

