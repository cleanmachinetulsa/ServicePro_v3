import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import {
  CheckCircle2,
  Circle,
  Upload,
  FileArchive,
  Users,
  MessageSquare,
  MessagesSquare,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Sparkles,
  Download,
  Smartphone,
  CheckCircle,
  XCircle,
  PartyPopper,
} from 'lucide-react';
import { format } from 'date-fns';

const PARSER_TOOL_URL = 'https://phone-history-parser.example.com';

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

const steps = [
  { id: 1, title: 'Prepare', description: 'Get your export ready' },
  { id: 2, title: 'Upload', description: 'Upload your bundle' },
  { id: 3, title: 'Review', description: 'Check the results' },
  { id: 4, title: 'Finish', description: 'All done!' },
];

export default function AdminMigrationWizard() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStarted, setUploadStarted] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const lastImportIdRef = useRef<number | null>(null);

  const { data: latestImport, isLoading: importLoading, refetch: refetchImport } = useQuery<PhoneHistoryImport | null>({
    queryKey: ['/api/admin/import-history/latest'],
    refetchInterval: (data) => {
      if (uploadStarted && data?.state?.data?.status === 'processing') {
        return 2000;
      }
      return false;
    },
  });

  useEffect(() => {
    if (uploadStarted && latestImport && currentStep === 2) {
      if (latestImport.id !== lastImportIdRef.current) {
        lastImportIdRef.current = latestImport.id;
      }
      if (latestImport.status === 'success') {
        setCurrentStep(3);
      } else if (latestImport.status === 'failed') {
        setUploadError(latestImport.errorText || 'Import failed');
        setCurrentStep(3);
      }
    }
  }, [latestImport, uploadStarted, currentStep]);

  const resetWizard = () => {
    setCurrentStep(1);
    setUploadStarted(false);
    setUploadError(null);
    lastImportIdRef.current = null;
  };

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/import-history/latest'] });
      setUploadStarted(true);
      toast({
        title: 'Upload Complete',
        description: 'Your phone history has been imported. Review the results below.',
      });
    },
    onError: (error: any) => {
      setUploadError(error.message || 'Failed to upload phone history bundle');
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload phone history bundle',
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

  const goToNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isProcessing = latestImport?.status === 'processing';
  const isSuccess = latestImport?.status === 'success';
  const stats = latestImport?.stats;

  const hasCustomers = stats && (stats.customersImported > 0 || stats.customersUpdated > 0);
  const hasConversations = stats && stats.conversationsCreated > 0;
  const hasMessages = stats && stats.messagesImported > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Smartphone className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="text-page-title">
            Phone History Migration
          </h1>
          <p className="text-blue-200/70">
            Bring your old phone conversations into ServicePro in just a few steps.
          </p>
        </motion.div>

        <Card className="mb-6 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-white">Progress</span>
              <span className="text-sm text-blue-200/70">{currentStep} of {steps.length}</span>
            </div>
            <Progress value={(currentStep / steps.length) * 100} className="h-2 mb-4" />
            <div className="flex justify-between">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex flex-col items-center text-center transition-all ${
                    step.id <= currentStep ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-all ${
                      step.id < currentStep
                        ? 'bg-green-500 text-white'
                        : step.id === currentStep
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {step.id < currentStep ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <span className="text-sm font-medium">{step.id}</span>
                    )}
                  </div>
                  <span className="text-xs text-white/80 hidden sm:block">{step.title}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 1 && (
              <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-xl" data-testid="step-prepare">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <Download className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-white">Prepare Your Export</CardTitle>
                      <CardDescription className="text-blue-200/70">
                        Get your phone data ready to import
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-400 font-bold">1</span>
                      </div>
                      <div>
                        <h4 className="text-white font-medium mb-1">Download your phone data</h4>
                        <p className="text-blue-200/60 text-sm">
                          Export your messages from your phone or Google Voice. Most phones let you do this
                          through Settings → Messages → Export.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-400 font-bold">2</span>
                      </div>
                      <div>
                        <h4 className="text-white font-medium mb-1">Use the Parser Tool</h4>
                        <p className="text-blue-200/60 text-sm mb-3">
                          Our free parser tool converts your phone export into a format ServicePro understands.
                          Just upload your export file and click "Parse".
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                          onClick={() => window.open(PARSER_TOOL_URL, '_blank')}
                          data-testid="button-parser-tool"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open Parser Tool
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-400 font-bold">3</span>
                      </div>
                      <div>
                        <h4 className="text-white font-medium mb-1">Download the ServicePro Bundle</h4>
                        <p className="text-blue-200/60 text-sm">
                          After parsing, download the "ServicePro Bundle" ZIP file. This file contains your
                          customers, conversations, and messages ready for import.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={goToNextStep}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
                      data-testid="button-next-step"
                    >
                      I have my bundle ready
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && (
              <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-xl" data-testid="step-upload">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-white">Upload Your Bundle</CardTitle>
                      <CardDescription className="text-blue-200/70">
                        Drop your ServicePro Bundle ZIP file here
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`
                      border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer
                      ${isDragging 
                        ? 'border-blue-400 bg-blue-500/10' 
                        : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
                      }
                      ${uploadMutation.isPending ? 'pointer-events-none opacity-60' : ''}
                    `}
                    onClick={() => !uploadMutation.isPending && document.getElementById('file-upload')?.click()}
                    data-testid="dropzone-upload"
                  >
                    <input
                      id="file-upload"
                      type="file"
                      accept=".zip"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={uploadMutation.isPending}
                      data-testid="input-file"
                    />
                    
                    {uploadMutation.isPending ? (
                      <div className="space-y-3">
                        <Loader2 className="w-12 h-12 text-blue-400 mx-auto animate-spin" />
                        <p className="text-white font-medium">Processing your bundle...</p>
                        <p className="text-blue-200/60 text-sm">This may take a few minutes</p>
                      </div>
                    ) : (
                      <>
                        <FileArchive className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                        <p className="text-white font-medium mb-2">
                          {isDragging ? 'Drop your file here' : 'Drag & drop your ZIP file'}
                        </p>
                        <p className="text-blue-200/60 text-sm mb-4">or click to browse</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                          data-testid="button-upload"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Select File
                        </Button>
                      </>
                    )}
                  </div>

                  {isProcessing && (
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                        <div>
                          <p className="text-white font-medium">Import in progress...</p>
                          <p className="text-blue-200/60 text-sm">This may take a few minutes for large files</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-white/80 text-sm font-medium">Detection Checklist:</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                        {hasCustomers ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-white/30" />
                        )}
                        <span className={hasCustomers ? 'text-white' : 'text-white/50'}>
                          Customers detected
                          {hasCustomers && stats && (
                            <span className="text-blue-200/60 ml-2">
                              ({stats.customersImported} new, {stats.customersUpdated} updated)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                        {hasConversations ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-white/30" />
                        )}
                        <span className={hasConversations ? 'text-white' : 'text-white/50'}>
                          Conversations detected
                          {hasConversations && stats && (
                            <span className="text-blue-200/60 ml-2">
                              ({stats.conversationsCreated} created)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                        {hasMessages ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-white/30" />
                        )}
                        <span className={hasMessages ? 'text-white' : 'text-white/50'}>
                          Messages detected
                          {hasMessages && stats && (
                            <span className="text-blue-200/60 ml-2">
                              ({stats.messagesImported} imported)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button
                      variant="outline"
                      onClick={goToPrevStep}
                      className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                      data-testid="button-prev-step"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    {isSuccess && (
                      <Button
                        onClick={goToNextStep}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
                        data-testid="button-next-step"
                      >
                        Review Results
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 3 && (
              <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-xl" data-testid="step-review">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center ${
                      latestImport?.status === 'failed' || uploadError 
                        ? 'from-red-500 to-red-600' 
                        : latestImport?.status === 'processing'
                        ? 'from-blue-500 to-blue-600'
                        : 'from-emerald-500 to-teal-600'
                    }`}>
                      {latestImport?.status === 'processing' ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : latestImport?.status === 'failed' || uploadError ? (
                        <XCircle className="w-5 h-5 text-white" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-white">
                        {latestImport?.status === 'processing' 
                          ? 'Processing Import...' 
                          : latestImport?.status === 'failed' || uploadError
                          ? 'Import Failed'
                          : 'Review Summary'}
                      </CardTitle>
                      <CardDescription className="text-blue-200/70">
                        {latestImport?.status === 'processing'
                          ? 'Please wait while we import your data'
                          : latestImport?.status === 'failed' || uploadError
                          ? 'Something went wrong during import'
                          : "Here's what was imported from your phone history"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {latestImport?.status === 'processing' ? (
                    <div className="p-6 rounded-xl bg-blue-500/10 border border-blue-500/30 text-center">
                      <Loader2 className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
                      <p className="text-white font-medium mb-2">Processing your phone history...</p>
                      <p className="text-blue-200/60 text-sm">This may take a few minutes for large files</p>
                      {latestImport?.fileName && (
                        <p className="text-blue-200/50 text-xs mt-3">
                          File: {latestImport.fileName}
                        </p>
                      )}
                    </div>
                  ) : latestImport?.status === 'failed' || uploadError ? (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                        <div>
                          <p className="text-white font-medium">Import Failed</p>
                          <p className="text-red-200/80 text-sm mt-1">
                            {uploadError || latestImport?.errorText || 'An error occurred during import'}
                          </p>
                          {latestImport?.fileName && (
                            <p className="text-red-200/50 text-xs mt-2">
                              File: {latestImport.fileName}
                            </p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 bg-white/5 border-white/20 text-white hover:bg-white/10"
                            onClick={() => {
                              setUploadError(null);
                              setCurrentStep(2);
                            }}
                            data-testid="button-try-again"
                          >
                            Try Again
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : !stats ? (
                    <div className="p-6 rounded-xl bg-white/5 border border-white/10 text-center">
                      <p className="text-blue-200/60">No import data available yet.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 bg-white/5 border-white/20 text-white hover:bg-white/10"
                        onClick={() => setCurrentStep(2)}
                        data-testid="button-upload-file"
                      >
                        Upload a file
                      </Button>
                    </div>
                  ) : (
                    <>
                      {latestImport?.fileName && (
                        <div className="text-center text-blue-200/50 text-sm mb-2">
                          Imported from: {latestImport.fileName}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 text-center" data-testid="stat-customers">
                          <Users className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-white">
                            {stats.customersImported + stats.customersUpdated}
                          </div>
                          <div className="text-blue-200/60 text-sm">Customers</div>
                          {stats.customersUpdated > 0 && (
                            <Badge variant="secondary" className="mt-1 bg-blue-500/20 text-blue-200 border-0">
                              {stats.customersUpdated} updated
                            </Badge>
                          )}
                        </div>
                        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 text-center" data-testid="stat-conversations">
                          <MessagesSquare className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-white">
                            {stats.conversationsCreated}
                          </div>
                          <div className="text-purple-200/60 text-sm">Conversations</div>
                        </div>
                        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 text-center" data-testid="stat-messages">
                          <MessageSquare className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-white">
                            {stats.messagesImported}
                          </div>
                          <div className="text-emerald-200/60 text-sm">Messages</div>
                        </div>
                      </div>

                      {stats.errorsCount > 0 && (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                          <p className="text-amber-200 text-sm">
                            <span className="font-medium">{stats.errorsCount} items</span> couldn't be imported due to missing or invalid data.
                            Don't worry - everything else was imported successfully!
                          </p>
                        </div>
                      )}

                      {latestImport?.completedAt && (
                        <div className="text-center text-blue-200/60 text-sm">
                          Completed {format(new Date(latestImport.completedAt), 'PPp')}
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex justify-between pt-4">
                    <Button
                      variant="outline"
                      onClick={goToPrevStep}
                      className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                      data-testid="button-prev-step"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    {latestImport?.status === 'success' && (
                      <Button
                        onClick={goToNextStep}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
                        data-testid="button-next-step"
                      >
                        Finish
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 4 && (
              <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-xl" data-testid="step-finish">
                <CardContent className="pt-8 pb-8 text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-green-500/25">
                    <PartyPopper className="w-10 h-10 text-white" />
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                      Migration Complete!
                    </h2>
                    <p className="text-blue-200/70 max-w-md mx-auto">
                      Your phone history is now part of ServicePro. All your customers and conversations
                      are ready to use.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                    <Link href="/messages">
                      <Button
                        className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
                        data-testid="button-go-messages"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Go to Messages
                      </Button>
                    </Link>
                    <Link href="/customers">
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto bg-white/5 border-white/20 text-white hover:bg-white/10"
                        data-testid="button-go-customers"
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Go to Customers
                      </Button>
                    </Link>
                  </div>

                  <div className="pt-4 flex flex-col items-center gap-2">
                    <Button
                      variant="link"
                      className="text-blue-300 hover:text-blue-200"
                      onClick={resetWizard}
                      data-testid="button-start-new"
                    >
                      Import another file
                    </Button>
                    <Link href="/admin/import-history">
                      <Button
                        variant="link"
                        className="text-blue-300/60 hover:text-blue-200"
                        data-testid="link-import-history"
                      >
                        View Import History
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 text-center">
          <Link href="/admin/import-history">
            <Button
              variant="link"
              className="text-blue-300/60 hover:text-blue-200"
              data-testid="link-advanced-import"
            >
              Need more control? Use the advanced import page
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
