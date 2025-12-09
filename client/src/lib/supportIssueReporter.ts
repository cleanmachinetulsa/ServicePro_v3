import { apiRequest } from './queryClient';

export interface SupportIssueReport {
  category: 'bug' | 'feature_request' | 'question' | 'feedback' | 'error' | 'integration_issue';
  title: string;
  description: string;
  errorDetails?: string;
  stackTrace?: string;
  browserInfo?: string;
  url?: string;
  additionalContext?: Record<string, unknown>;
}

async function reportSupportIssue(issue: SupportIssueReport): Promise<{ id: number } | null> {
  try {
    const browserInfo = typeof navigator !== 'undefined' 
      ? `${navigator.userAgent} | ${window.innerWidth}x${window.innerHeight}` 
      : 'Unknown';
    
    const payload = {
      category: issue.category,
      title: issue.title.substring(0, 200),
      description: issue.description,
      errorDetails: issue.errorDetails,
      stackTrace: issue.stackTrace?.substring(0, 10000),
      browserInfo: issue.browserInfo || browserInfo,
      url: issue.url || (typeof window !== 'undefined' ? window.location.href : undefined),
      additionalContext: issue.additionalContext,
    };
    
    const response = await apiRequest('POST', '/api/support-issues', payload);
    return response.json();
  } catch (error) {
    console.error('[SupportIssueReporter] Failed to report issue:', error);
    return null;
  }
}

export async function reportError(
  error: Error | string,
  context?: { title?: string; additionalContext?: Record<string, unknown> }
): Promise<{ id: number } | null> {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const stackTrace = typeof error === 'object' && error instanceof Error ? error.stack : undefined;
  
  return reportSupportIssue({
    category: 'error',
    title: context?.title || `Error: ${errorMessage.substring(0, 100)}`,
    description: errorMessage,
    stackTrace,
    additionalContext: context?.additionalContext,
  });
}

export async function reportBug(
  title: string,
  description: string,
  additionalContext?: Record<string, unknown>
): Promise<{ id: number } | null> {
  return reportSupportIssue({
    category: 'bug',
    title,
    description,
    additionalContext,
  });
}

export async function reportIntegrationIssue(
  integrationName: string,
  errorMessage: string,
  additionalContext?: Record<string, unknown>
): Promise<{ id: number } | null> {
  return reportSupportIssue({
    category: 'integration_issue',
    title: `${integrationName} Integration Issue`,
    description: errorMessage,
    additionalContext: {
      integrationName,
      ...additionalContext,
    },
  });
}

export async function reportFromAssistant(
  userMessage: string,
  assistantResponse: string,
  issueType: 'error' | 'bug' | 'feature_request' | 'question',
  additionalDetails?: string
): Promise<{ id: number } | null> {
  return reportSupportIssue({
    category: issueType,
    title: `Assistant Issue: ${userMessage.substring(0, 80)}`,
    description: `User Message:\n${userMessage}\n\nAssistant Response:\n${assistantResponse}${additionalDetails ? `\n\nAdditional Details:\n${additionalDetails}` : ''}`,
    additionalContext: {
      source: 'setup_assistant',
      userMessage,
      assistantResponse,
    },
  });
}

export default {
  reportError,
  reportBug,
  reportIntegrationIssue,
  reportFromAssistant,
};
