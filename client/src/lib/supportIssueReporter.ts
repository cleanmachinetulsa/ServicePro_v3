import { apiRequest } from './queryClient';

export interface SupportIssueReport {
  errorCode: string;
  summary: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  source?: string;
  details?: Record<string, unknown>;
  userContactEmail?: string;
}

async function reportSupportIssue(issue: SupportIssueReport): Promise<{ id: number } | null> {
  try {
    const browserInfo = typeof navigator !== 'undefined' 
      ? `${navigator.userAgent} | ${window.innerWidth}x${window.innerHeight}` 
      : 'Unknown';
    
    const payload = {
      errorCode: issue.errorCode,
      summary: issue.summary.substring(0, 500),
      severity: issue.severity || 'error',
      source: issue.source || 'frontend',
      details: {
        ...issue.details,
        browserInfo,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
      userContactEmail: issue.userContactEmail,
    };
    
    const response = await apiRequest('POST', '/api/support/issues', payload);
    return response.json();
  } catch (error) {
    console.error('[SupportIssueReporter] Failed to report issue:', error);
    return null;
  }
}

export async function reportError(
  error: Error | string,
  context?: { errorCode?: string; additionalContext?: Record<string, unknown> }
): Promise<{ id: number } | null> {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const stackTrace = typeof error === 'object' && error instanceof Error ? error.stack : undefined;
  
  return reportSupportIssue({
    errorCode: context?.errorCode || 'FRONTEND_ERROR',
    summary: errorMessage.substring(0, 500),
    severity: 'error',
    source: 'frontend',
    details: {
      stackTrace,
      ...context?.additionalContext,
    },
  });
}

export async function reportBug(
  title: string,
  description: string,
  additionalContext?: Record<string, unknown>
): Promise<{ id: number } | null> {
  return reportSupportIssue({
    errorCode: 'USER_REPORTED_BUG',
    summary: title.substring(0, 500),
    severity: 'warning',
    source: 'user-feedback',
    details: {
      description,
      ...additionalContext,
    },
  });
}

export async function reportIntegrationIssue(
  integrationName: string,
  errorMessage: string,
  additionalContext?: Record<string, unknown>
): Promise<{ id: number } | null> {
  return reportSupportIssue({
    errorCode: `INTEGRATION_${integrationName.toUpperCase().replace(/\s+/g, '_')}`,
    summary: `${integrationName}: ${errorMessage}`.substring(0, 500),
    severity: 'error',
    source: 'integration',
    details: {
      integrationName,
      ...additionalContext,
    },
  });
}

export async function reportFromAssistant(
  userMessage: string,
  errorMessage: string,
  errorCode: string = 'ASSISTANT_ERROR'
): Promise<{ id: number } | null> {
  return reportSupportIssue({
    errorCode,
    summary: `Assistant Error: ${errorMessage}`.substring(0, 500),
    severity: 'error',
    source: 'setup-assistant',
    details: {
      userMessage,
      errorMessage,
    },
  });
}

export default {
  reportError,
  reportBug,
  reportIntegrationIssue,
  reportFromAssistant,
};
