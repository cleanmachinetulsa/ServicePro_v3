export type SupportAssistantRole = 'user' | 'assistant' | 'system';

export interface SupportAssistantMessage {
  id: string;
  role: SupportAssistantRole;
  content: string;
  createdAt: string;
  source?: 'kb' | 'agent' | 'system';
  kbArticleId?: string | null;
}

export interface SupportAssistantContext {
  tenantId: string;
  userId: number;
  userName?: string | null;
  currentRoute: string;
  isOwner: boolean;
  isAdmin: boolean;
  lastErrorMessage?: string | null;
}

export interface SupportAssistantUsedArticle {
  slug: string;
  title: string;
  scope: string;
  category: string;
}
