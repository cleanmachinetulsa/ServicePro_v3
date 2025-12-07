import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  FileArchive, 
  Users, 
  MessageSquare, 
  MessagesSquare, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { Link } from 'wouter';
import { format } from 'date-fns';

interface ImportStats {
  customersImported: number;
  customersUpdated: number;
  conversationsCreated: number;
  messagesImported: number;
  errorsCount: number;
  errors?: string[];
}

interface PhoneHistoryImport {
  id: number;
  tenantId: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  stats: ImportStats | null;
  errorText: string | null;
  fileName: string | null;
  createdAt: string;
  completedAt: string | null;
}

export default function AdminImportHistory() {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const { data: latestImport, isLoading } = useQuery<PhoneHistoryImport | null>({
    queryKey: ['/api/admin/import-history/latest'],
  });

  const { data: importHistory } = useQuery<PhoneHistoryImport[]>({
    queryKey: ['/api/admin/import-history/history'],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/import-history/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/import-history/latest'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/import-history/history'] });
      toast({
        title: 'Import Complete',
        description: `Imported ${data.stats?.customersImported || 0} customers, ${data.stats?.conversationsCreated || 0} conversations, and ${data.stats?.messagesImported || 0} messages.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import phone history',
        variant: 'destructive',
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file && (file.type === 'application/zip' || file.name.endsWith('.zip'))) {
        uploadMutation.mutate(file);
      } else {
        toast({
          title: 'Invalid File',
          description: 'Please upload a ZIP file',
          variant: 'destructive',
        });
      }
    },
    [uploadMutation, toast]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500 hover:bg-green-600" data-testid="badge-status"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>;
      case 'failed':
        return <Badge variant="destructive" data-testid="badge-status"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'processing':
        return <Badge variant="secondary" data-testid="badge-status"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-status"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/settings">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100" data-testid="text-page-title">
              Phone History Import
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
              Import customers, conversations, and messages from your phone history
            </p>
          </div>
        </div>

        <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <AlertTitle className="text-blue-800 dark:text-blue-200">Prefer a guided flow?</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            <span className="block mb-2">
              The Migration Wizard walks you through the process step-by-step.
            </span>
            <Link href="/admin/migration-wizard">
              <Button variant="outline" size="sm" className="bg-white dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-800" data-testid="button-migration-wizard">
                <Sparkles className="w-4 h-4 mr-2" />
                Use Migration Wizard
              </Button>
            </Link>
          </AlertDescription>
        </Alert>

        <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-500" />
              Bring Your Phone History
            </CardTitle>
            <CardDescription>
              Upload a ZIP bundle generated by the Phone History Parser tool. The bundle should contain customers.csv/json and messages.csv/json files.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`
                relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'}
                ${uploadMutation.isPending ? 'opacity-50 pointer-events-none' : ''}
              `}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              data-testid="dropzone-upload"
            >
              <input
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploadMutation.isPending}
                data-testid="input-file"
              />
              
              {uploadMutation.isPending ? (
                <div className="space-y-3">
                  <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                    Importing phone history...
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This may take a few moments
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <FileArchive className="w-10 h-10 text-blue-500" />
                    </div>
                  </div>
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                    {isDragging ? 'Drop your ZIP file here' : 'Drag & drop your ZIP file here'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    or click to browse
                  </p>
                  <Button variant="outline" size="sm" className="mt-2" data-testid="button-upload">
                    <Upload className="w-4 h-4 mr-2" />
                    Select ZIP File
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">Loading import status...</span>
              </div>
            </CardContent>
          </Card>
        ) : latestImport ? (
          <Card data-testid="card-latest-import">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-gray-500" />
                  Last Import
                </span>
                {getStatusBadge(latestImport.status)}
              </CardTitle>
              <CardDescription>
                {latestImport.fileName || 'Phone history bundle'} • Imported {format(new Date(latestImport.createdAt), 'MMM d, yyyy h:mm a')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {latestImport.stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-center" data-testid="stat-customers">
                    <Users className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {latestImport.stats.customersImported}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Customers Added
                    </div>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 text-center" data-testid="stat-updated">
                    <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-500" />
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {latestImport.stats.customersUpdated}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Customers Updated
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 text-center" data-testid="stat-conversations">
                    <MessageSquare className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {latestImport.stats.conversationsCreated}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Conversations
                    </div>
                  </div>
                  
                  <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-4 text-center" data-testid="stat-messages">
                    <MessagesSquare className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {latestImport.stats.messagesImported}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Messages
                    </div>
                  </div>
                </div>
              )}

              {latestImport.stats?.errorsCount && latestImport.stats.errorsCount > 0 && (
                <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="flex items-center justify-between">
                    <span>{latestImport.stats.errorsCount} Error{latestImport.stats.errorsCount > 1 ? 's' : ''} Occurred</span>
                    {latestImport.stats.errors && latestImport.stats.errors.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowErrors(!showErrors)}
                        data-testid="button-toggle-errors"
                      >
                        {showErrors ? 'Hide Details' : 'Show Details'}
                      </Button>
                    )}
                  </AlertTitle>
                  {showErrors && latestImport.stats.errors && (
                    <AlertDescription className="mt-2">
                      <ul className="list-disc list-inside text-sm space-y-1 max-h-40 overflow-y-auto">
                        {latestImport.stats.errors.slice(0, 20).map((error, index) => (
                          <li key={index} className="text-red-700 dark:text-red-400" data-testid={`text-error-${index}`}>
                            {error}
                          </li>
                        ))}
                        {latestImport.stats.errors.length > 20 && (
                          <li className="text-red-600 dark:text-red-500 font-medium">
                            ... and {latestImport.stats.errors.length - 20} more errors
                          </li>
                        )}
                      </ul>
                    </AlertDescription>
                  )}
                </Alert>
              )}

              {latestImport.errorText && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Import Failed</AlertTitle>
                  <AlertDescription data-testid="text-error-message">{latestImport.errorText}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileArchive className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No Import History</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Upload your first phone history bundle to get started
              </p>
            </CardContent>
          </Card>
        )}

        {importHistory && importHistory.length > 1 && (
          <Card data-testid="card-import-history">
            <CardHeader>
              <CardTitle className="text-lg">Import History</CardTitle>
              <CardDescription>Previous import attempts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {importHistory.slice(1).map((imp) => (
                  <div 
                    key={imp.id} 
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                    data-testid={`row-import-${imp.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusBadge(imp.status)}
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {imp.fileName || 'Bundle'}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {imp.stats ? (
                          `${imp.stats.customersImported + imp.stats.customersUpdated} customers, ${imp.stats.messagesImported} messages`
                        ) : (
                          '-'
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(imp.createdAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <FileArchive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-blue-900 dark:text-blue-200">Expected Bundle Format</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  The ZIP file should contain standardized CSV or JSON files:
                </p>
                <ul className="text-sm text-blue-600 dark:text-blue-400 list-disc list-inside space-y-0.5">
                  <li><strong>customers.csv/json</strong> - Name, phone (E.164), email, address, notes</li>
                  <li><strong>messages.csv/json</strong> - Phone, body, timestamp, direction (inbound/outbound)</li>
                  <li><strong>conversations.csv/json</strong> (optional) - Phone, platform</li>
                </ul>
                <p className="text-xs text-blue-500 dark:text-blue-500 mt-2">
                  Use the Phone History Parser tool to generate this bundle from your raw phone exports.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
