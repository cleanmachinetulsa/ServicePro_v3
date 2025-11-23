import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { fetchHandbackAnalysis, type SmartHandbackResult } from '@/lib/conversationApi';
import { useToast } from '@/hooks/use-toast';

interface HandbackAnalysisPanelProps {
  conversationId: number;
}

export function HandbackAnalysisPanel({ conversationId }: HandbackAnalysisPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<SmartHandbackResult | null>(null);
  const { toast } = useToast();

  async function handleAnalyze() {
    try {
      setIsLoading(true);
      const result = await fetchHandbackAnalysis(conversationId);
      setAnalysis(result);
    } catch (error) {
      console.error('[HANDBACK ANALYSIS] Error:', error);
      toast({
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'Failed to analyze conversation',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function getRecommendationBadge(shouldHandback: boolean, confidence: string) {
    if (shouldHandback) {
      return (
        <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" data-testid="badge-recommendation">
          <ThumbsUp className="h-3 w-3 mr-1" />
          Recommend handback ({confidence})
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" data-testid="badge-recommendation">
          <ThumbsDown className="h-3 w-3 mr-1" />
          Keep manual ({confidence})
        </Badge>
      );
    }
  }

  function getSentimentIcon(sentiment?: string) {
    switch (sentiment) {
      case 'satisfied':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'frustrated':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-400" />;
    }
  }

  return (
    <Card className="p-4 space-y-4" data-testid="card-handback-analysis">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-600" />
          AI Analysis
        </h3>
      </div>

      {!analysis ? (
        <Button
          onClick={handleAnalyze}
          disabled={isLoading}
          variant="outline"
          className="w-full"
          data-testid="button-analyze-handback"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4 mr-2" />
              Analyze handback readiness
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-4">
          {/* Recommendation */}
          <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800">
            {getRecommendationBadge(analysis.shouldHandback, analysis.confidence)}
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2" data-testid="text-analysis-reason">
              {analysis.reason}
            </p>
          </div>

          {/* Context Summary */}
          {analysis.contextSummary && (
            <div className="space-y-3 text-sm">
              {analysis.contextSummary.issueDescription && (
                <div>
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Issue</div>
                  <p className="text-gray-900 dark:text-gray-100" data-testid="text-issue-description">
                    {analysis.contextSummary.issueDescription}
                  </p>
                </div>
              )}

              {analysis.contextSummary.customerSentiment && (
                <div className="flex items-center gap-2">
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Customer:</div>
                  <div className="flex items-center gap-1">
                    {getSentimentIcon(analysis.contextSummary.customerSentiment)}
                    <span className="text-sm capitalize text-gray-900 dark:text-gray-100" data-testid="text-customer-sentiment">
                      {analysis.contextSummary.customerSentiment}
                    </span>
                  </div>
                </div>
              )}

              {analysis.contextSummary.actionsTaken && analysis.contextSummary.actionsTaken.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Actions Taken</div>
                  <ul className="space-y-1" data-testid="list-actions-taken">
                    {analysis.contextSummary.actionsTaken.map((action, idx) => (
                      <li key={idx} className="text-xs text-gray-700 dark:text-gray-300">
                        ✓ {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.contextSummary.outstandingItems && analysis.contextSummary.outstandingItems.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Outstanding</div>
                  <ul className="space-y-1" data-testid="list-outstanding-items">
                    {analysis.contextSummary.outstandingItems.map((item, idx) => (
                      <li key={idx} className="text-xs text-yellow-700 dark:text-yellow-300">
                        • {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.contextSummary.recommendedAIBehavior && (
                <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <div className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                    AI Guidance
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-300" data-testid="text-ai-guidance">
                    {analysis.contextSummary.recommendedAIBehavior}
                  </p>
                </div>
              )}
            </div>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAnalysis(null)}
            className="w-full"
            data-testid="button-close-analysis"
          >
            Close
          </Button>
        </div>
      )}
    </Card>
  );
}
