import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  History,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Brain,
  MessageSquare,
  Wrench,
  ChevronRight,
  RefreshCw,
  Shield,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

interface ImportSummary {
  id: number;
  tenantId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  createdAt: string;
  completedAt: string | null;
  appliedAt: string | null;
  serviceCount: number;
  faqCount: number;
  hasPersona: boolean;
  knowledgeApplied: boolean;
  errorText: string | null;
}

interface ParserStatus {
  success: boolean;
  status: 'online' | 'degraded' | 'offline';
  healthy: boolean;
  lastError: string | null;
  isProtectedTenant: boolean;
  protectionMessage: string | null;
}

export default function ParserHistory() {
  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery<ParserStatus>({
    queryKey: ["/api/onboarding/parser/status"],
    refetchInterval: 30000,
  });

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery<{ success: boolean; imports: ImportSummary[] }>({
    queryKey: ["/api/onboarding/parser/admin/history"],
  });

  const handleRefresh = () => {
    refetchStatus();
    refetchHistory();
  };

  const getStatusBadge = (status: ImportSummary['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getServiceStatusPill = () => {
    if (!statusData) return null;
    
    switch (statusData.status) {
      case 'online':
        return <Badge className="bg-green-500 text-white">Online</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500 text-white">Degraded</Badge>;
      default:
        return <Badge variant="destructive">Offline</Badge>;
    }
  };

  if (historyLoading || statusLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading parser history...</p>
        </div>
      </div>
    );
  }

  if (statusData?.isProtectedTenant) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <CardTitle>Protected Tenant</CardTitle>
                  <CardDescription>{statusData.protectionMessage}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                The parser onboarding tools are disabled for the Clean Machine production tenant to protect live data.
                Your AI agent and services are already configured and live.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const imports = historyData?.imports || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <History className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Parser Import History</h1>
              <p className="text-muted-foreground">View and manage your phone history parser imports</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getServiceStatusPill()}
            <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Parser Service Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold" data-testid="text-total-imports">{imports.length}</p>
                <p className="text-sm text-muted-foreground">Total Imports</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-green-600" data-testid="text-successful-imports">
                  {imports.filter(i => i.status === 'success').length}
                </p>
                <p className="text-sm text-muted-foreground">Successful</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-blue-600" data-testid="text-applied-imports">
                  {imports.filter(i => i.knowledgeApplied).length}
                </p>
                <p className="text-sm text-muted-foreground">Applied</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-red-600" data-testid="text-failed-imports">
                  {imports.filter(i => i.status === 'failed').length}
                </p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {imports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No imports yet</h3>
              <p className="text-muted-foreground mb-4">
                Start by importing your phone history in the Setup Wizard to train your AI agent.
              </p>
              <Link href="/admin/setup">
                <Button data-testid="button-go-to-setup">Go to Setup Wizard</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {imports.map((imp) => (
              <Card key={imp.id} className="hover:shadow-md transition-shadow" data-testid={`card-import-${imp.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium" data-testid={`text-filename-${imp.id}`}>{imp.fileName}</span>
                        {getStatusBadge(imp.status)}
                        {imp.knowledgeApplied && (
                          <Badge variant="outline" className="border-green-500 text-green-700">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Applied
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(imp.createdAt), 'MMM d, yyyy h:mm a')}
                        </span>
                        {imp.serviceCount > 0 && (
                          <span className="flex items-center gap-1" data-testid={`text-services-${imp.id}`}>
                            <Wrench className="w-3 h-3" />
                            {imp.serviceCount} services
                          </span>
                        )}
                        {imp.faqCount > 0 && (
                          <span className="flex items-center gap-1" data-testid={`text-faqs-${imp.id}`}>
                            <MessageSquare className="w-3 h-3" />
                            {imp.faqCount} FAQs
                          </span>
                        )}
                        {imp.hasPersona && (
                          <span className="flex items-center gap-1 text-purple-600" data-testid={`text-persona-${imp.id}`}>
                            <Brain className="w-3 h-3" />
                            Persona
                          </span>
                        )}
                      </div>
                      
                      {imp.errorText && (
                        <div className="mt-2 p-2 rounded bg-red-50 text-red-700 text-sm">
                          {imp.errorText}
                        </div>
                      )}
                    </div>
                    
                    <Link href={`/admin/parser-history/${imp.id}`}>
                      <Button variant="ghost" size="sm" data-testid={`button-view-${imp.id}`}>
                        View
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Separator className="my-8" />

        <div className="text-center">
          <Link href="/admin/setup">
            <Button variant="outline" data-testid="button-back-to-setup">
              Back to Setup Wizard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
