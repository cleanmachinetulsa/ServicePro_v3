import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Activity,
  ExternalLink,
} from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import type {
  TenantReadinessReport,
  ReadinessCategory,
  ReadinessItem,
  ReadinessStatus,
} from '../../../../shared/readinessTypes';

interface TenantReadinessCardProps {
  tenantId: string;
  tenantSlug?: string;
  tenantName?: string;
}

const STATUS_CONFIG: Record<
  ReadinessStatus,
  { icon: typeof CheckCircle2; color: string; bgColor: string; label: string }
> = {
  pass: {
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'READY',
  },
  warn: {
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'NEEDS CONFIG',
  },
  fail: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'BLOCKED',
  },
};

function StatusIcon({ status, className }: { status: ReadinessStatus; className?: string }) {
  const config = STATUS_CONFIG[status];
  const IconComponent = config.icon;
  return <IconComponent className={`${config.color} ${className || ''}`} />;
}

function StatusBadge({ status }: { status: ReadinessStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge
      variant="outline"
      className={`${config.bgColor} ${config.color} border-0 font-semibold`}
      data-testid={`badge-status-${status}`}
    >
      {config.label}
    </Badge>
  );
}

function ReadinessItemRow({ item }: { item: ReadinessItem }) {
  const config = STATUS_CONFIG[item.status];
  const [, setLocation] = useLocation();
  
  const handleClick = () => {
    if (item.fixUrl && item.status !== 'pass') {
      setLocation(item.fixUrl);
    }
  };
  
  const isClickable = item.fixUrl && item.status !== 'pass';
  
  return (
    <div
      className={`flex items-start gap-3 py-2 px-3 rounded-lg transition-colors ${
        isClickable 
          ? 'hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800' 
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
      }`}
      data-testid={`readiness-item-${item.key}`}
      onClick={handleClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <StatusIcon status={item.status} className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
            {item.label}
          </span>
          <Badge variant="outline" className={`${config.color} text-xs px-1.5 py-0`}>
            {item.status.toUpperCase()}
          </Badge>
          {isClickable && (
            <ExternalLink className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
          )}
        </div>
        {item.details && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {item.details}
          </p>
        )}
        {item.suggestion && item.status !== 'pass' && (
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 flex items-start gap-1">
            <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{item.suggestion}</span>
          </p>
        )}
        {isClickable && (
          <p className="text-xs text-blue-500 dark:text-blue-400 mt-1 font-medium">
            Click to fix this issue →
          </p>
        )}
      </div>
    </div>
  );
}

function CategorySection({ category }: { category: ReadinessCategory }) {
  const passCount = category.items.filter((i) => i.status === 'pass').length;
  const warnCount = category.items.filter((i) => i.status === 'warn').length;
  const failCount = category.items.filter((i) => i.status === 'fail').length;
  
  const categoryStatus: ReadinessStatus = failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass';

  return (
    <AccordionItem value={category.id} className="border-b last:border-b-0">
      <AccordionTrigger
        className="hover:no-underline py-3 px-2"
        data-testid={`accordion-trigger-${category.id}`}
      >
        <div className="flex items-center gap-3 w-full">
          <StatusIcon status={categoryStatus} className="w-5 h-5" />
          <span className="font-medium text-gray-900 dark:text-gray-100 flex-1 text-left">
            {category.label}
          </span>
          <div className="flex items-center gap-2 mr-2">
            {passCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                {passCount} pass
              </span>
            )}
            {warnCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                {warnCount} warn
              </span>
            )}
            {failCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                {failCount} fail
              </span>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-2 pb-3">
        <div className="space-y-1">
          {category.items.map((item) => (
            <ReadinessItemRow key={item.key} item={item} />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function TenantReadinessCard({ tenantId, tenantSlug, tenantName }: TenantReadinessCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const identifier = tenantSlug || tenantId;

  const {
    data: readinessData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{ ok: boolean; report: TenantReadinessReport }>({
    queryKey: ['/api/admin/tenant-readiness', identifier],
    queryFn: async () => {
      const response = await fetch(`/api/admin/tenant-readiness/${identifier}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch readiness report');
      }
      return response.json();
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        queryKey: ['/api/admin/tenant-readiness', identifier],
      });
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const report = readinessData?.report;

  if (isLoading) {
    return (
      <Card className="p-6" data-testid="readiness-card-loading">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="p-6 border-red-200 dark:border-red-800" data-testid="readiness-card-error">
        <div className="flex items-center gap-3 mb-4">
          <XCircle className="w-6 h-6 text-red-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Tenant Readiness
          </h3>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-4">
          <p className="text-red-700 dark:text-red-400 text-sm">
            {(error as Error)?.message || 'Failed to load readiness report'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          data-testid="button-retry-readiness"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Retry
        </Button>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="p-6" data-testid="readiness-card-empty">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-6 h-6 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Tenant Readiness
          </h3>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          No readiness data available.
        </p>
      </Card>
    );
  }

  const overallConfig = STATUS_CONFIG[report.overallStatus];
  const scorePercent = Math.round(
    (report.summary.passCount / report.summary.totalItems) * 100
  );

  return (
    <Card className="overflow-hidden" data-testid="readiness-card">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${overallConfig.bgColor}`}>
              <Activity className={`w-5 h-5 ${overallConfig.color}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Tenant Readiness
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {tenantName || report.tenantName}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh-readiness"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <StatusBadge status={report.overallStatus} />
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {scorePercent}%
            </span>
            <span>complete</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {report.summary.passCount}
            </div>
            <div className="text-xs text-green-700 dark:text-green-300">Passed</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {report.summary.warnCount}
            </div>
            <div className="text-xs text-amber-700 dark:text-amber-300">Warnings</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {report.summary.failCount}
            </div>
            <div className="text-xs text-red-700 dark:text-red-300">Failed</div>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Last checked: {new Date(report.generatedAt).toLocaleString()}
        </div>
      </div>

      <Accordion type="multiple" className="px-4 py-2" defaultValue={[]}>
        {report.categories.map((category) => (
          <CategorySection key={category.id} category={category} />
        ))}
      </Accordion>
    </Card>
  );
}

export default TenantReadinessCard;
