import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  RefreshCw, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  Database,
  Eye,
  ArrowRight,
  Table
} from 'lucide-react';

interface NormalizedCustomer {
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  vehicleInfo: string | null;
  notes: string | null;
  lastServiceAt: string | null;
}

interface ImportSummary {
  totalRows: number;
  normalizedRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  sampleRows?: NormalizedCustomer[];
}

interface PreviewData {
  sampleRows: NormalizedCustomer[];
  totalRows: number;
  normalizedRows: number;
  tabsFound: string[];
}

export default function CustomerSheetsImportPage() {
  const [dryRunMode, setDryRunMode] = useState(true);
  const [lastResult, setLastResult] = useState<ImportSummary | null>(null);

  const previewQuery = useQuery<{ success: boolean; preview: PreviewData }>({
    queryKey: ['/api/admin/import/customers-from-sheets/preview'],
    refetchOnWindowFocus: false,
  });

  const importMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const response = await apiRequest('POST', '/api/admin/import/customers-from-sheets', {
        dryRun,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setLastResult(data.summary);
      if (!data.dryRun) {
        queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/import/customers-from-sheets/preview'] });
      }
    },
  });

  const handleRunImport = () => {
    importMutation.mutate(dryRunMode);
  };

  const preview = previewQuery.data?.preview;

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Database className="w-8 h-8 text-green-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Customer Import from Google Sheets
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sync your Google Sheets customer data into the app database
          </p>
        </div>
      </div>

      <Card data-testid="card-sheets-import">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Table className="w-5 h-5 text-green-500" />
            Google Sheets Connection
          </CardTitle>
          <CardDescription>
            This will sync your Customer Information sheet into the app's customer database.
            Existing customers will be updated with missing data; new ones will be added.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {previewQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
              <span className="text-gray-500">Loading sheet preview...</span>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {preview.totalRows}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Total Rows
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {preview.normalizedRows}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Valid Customers
                  </div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {preview.tabsFound.length}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Tabs Found
                  </div>
                </div>
              </div>

              {preview.tabsFound.length > 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Found tabs: <span className="font-medium">{preview.tabsFound.join(', ')}</span>
                </div>
              )}

              {preview.sampleRows && preview.sampleRows.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sample Customers (first 5)
                  </div>
                  <div className="divide-y dark:divide-gray-700">
                    {preview.sampleRows.slice(0, 5).map((row, idx) => (
                      <div key={idx} className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {row.name || 'Unknown'}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">
                          {row.phone} {row.email && `• ${row.email}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Unable to load preview</AlertTitle>
              <AlertDescription>
                Could not connect to Google Sheets or no customer data found.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-500" />
              <Label htmlFor="dry-run-toggle" className="text-sm font-medium">
                Preview Mode (Dry Run)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {dryRunMode ? 'Preview only - no changes will be made' : 'Will import customers to database'}
              </span>
              <Switch
                id="dry-run-toggle"
                checked={dryRunMode}
                onCheckedChange={setDryRunMode}
                data-testid="switch-dry-run-sheets"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleRunImport}
              disabled={importMutation.isPending}
              className={dryRunMode ? '' : 'bg-green-600 hover:bg-green-700'}
              data-testid="button-run-import"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {dryRunMode ? 'Running Preview...' : 'Importing...'}
                </>
              ) : (
                <>
                  {dryRunMode ? (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Run Dry Run
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Run Import
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {lastResult && (
        <Card className={lastResult.errors.length > 0 ? 'border-yellow-400' : 'border-green-400'} data-testid="card-import-result">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Import Results {dryRunMode && <span className="text-sm font-normal text-yellow-600">(Preview Only)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-gray-600 dark:text-gray-300">
                  {lastResult.totalRows}
                </div>
                <div className="text-xs text-gray-500">Total Rows</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {lastResult.normalizedRows}
                </div>
                <div className="text-xs text-gray-500">Valid</div>
              </div>
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                <Users className="w-4 h-4 mx-auto mb-1 text-green-500" />
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {lastResult.created}
                </div>
                <div className="text-xs text-gray-500">Created</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 text-center">
                <RefreshCw className="w-4 h-4 mx-auto mb-1 text-orange-500" />
                <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {lastResult.updated}
                </div>
                <div className="text-xs text-gray-500">Updated</div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-gray-600 dark:text-gray-300">
                  {lastResult.skipped}
                </div>
                <div className="text-xs text-gray-500">Skipped</div>
              </div>
            </div>

            {lastResult.errors.length > 0 && (
              <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/30">
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle>{lastResult.errors.length} Error(s)</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc ml-4 mt-2 text-sm">
                    {lastResult.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {lastResult.errors.length > 5 && (
                      <li>...and {lastResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {dryRunMode && lastResult.created + lastResult.updated > 0 && (
              <Alert className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-200">Ready to Import</AlertTitle>
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  This was a preview run. No changes were made to your database.
                  Turn off "Preview Mode" and click "Run Import" to apply these changes.
                </AlertDescription>
              </Alert>
            )}

            {!dryRunMode && (
              <Alert className="bg-green-50 dark:bg-green-950/30 border-green-300">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-200">Import Complete</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  Successfully synced {lastResult.created} new customers and updated {lastResult.updated} existing records.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
