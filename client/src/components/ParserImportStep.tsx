import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, FileText, CheckCircle2, AlertCircle, Brain, ListPlus, MessageSquare, Sparkles, X } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ParserPreview {
  servicesCount: number;
  faqCount: number;
  styleSnippets: string[];
}

interface ParserAnalytics {
  calls?: { total?: number; missed?: number; received?: number };
  conversations?: { total?: number; avgLength?: number; threads?: number };
}

interface ParserRunResult {
  success: boolean;
  importId?: number;
  analytics?: ParserAnalytics;
  preview?: ParserPreview;
  error?: string;
}

interface ParserApplyResult {
  success: boolean;
  created: { services: number; faqs: number };
  updated: { services: number; faqs: number };
  skipped: { services: number; faqs: number };
  toneApplied: boolean;
  error?: string;
}

interface ParserImportStepProps {
  onComplete?: () => void;
  showSkip?: boolean;
}

export function ParserImportStep({ onComplete, showSkip = true }: ParserImportStepProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [parserResult, setParserResult] = useState<ParserRunResult | null>(null);
  
  const [applyFaqs, setApplyFaqs] = useState(false);
  const [applyServices, setApplyServices] = useState(false);
  const [applyTone, setApplyTone] = useState(false);

  const hasServices = (parserResult?.preview?.servicesCount || 0) > 0;
  const hasFaqs = (parserResult?.preview?.faqCount || 0) > 0;
  const hasTone = (parserResult?.preview?.styleSnippets?.length || 0) > 0;

  const initializeApplyToggles = (preview: ParserPreview | undefined) => {
    if (preview) {
      setApplyServices(preview.servicesCount > 0);
      setApplyFaqs(preview.faqCount > 0);
      setApplyTone((preview.styleSnippets?.length || 0) > 0);
    }
  };

  const { data: latestImport } = useQuery<{ success: boolean; import: any }>({
    queryKey: ['/api/onboarding/parser/latest'],
    staleTime: 30000,
  });

  const runParserMutation = useMutation({
    mutationFn: async (uploadFiles: File[]) => {
      const formData = new FormData();
      uploadFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('includeFaqs', 'true');
      formData.append('includeToneProfile', 'true');
      formData.append('includeServices', 'true');
      formData.append('includeAnalytics', 'true');

      const response = await fetch('/api/onboarding/parser/run', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Parser request failed');
      }
      
      return response.json() as Promise<ParserRunResult>;
    },
    onSuccess: (result) => {
      if (result.success) {
        setParserResult(result);
        initializeApplyToggles(result.preview);
        toast({
          title: 'Files analyzed!',
          description: `Found ${result.preview?.servicesCount || 0} services and ${result.preview?.faqCount || 0} FAQs`,
        });
      } else {
        toast({
          title: 'Analysis failed',
          description: result.error || 'Unknown error',
          variant: 'destructive',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/parser/latest'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Parser error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!parserResult?.importId) throw new Error('No import to apply');
      
      return apiRequest('POST', '/api/onboarding/parser/apply', {
        importId: parserResult.importId,
        applyFaqs,
        applyServices,
        applyTone,
      }) as Promise<ParserApplyResult>;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: 'Knowledge applied!',
          description: `Created ${result.created.services} services and ${result.created.faqs} FAQs`,
        });
        onComplete?.();
      } else {
        toast({
          title: 'Apply failed',
          description: result.error || 'Unknown error',
          variant: 'destructive',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/parser/latest'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Apply error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = () => {
    if (files.length === 0) return;
    runParserMutation.mutate(files);
  };

  const handleApply = () => {
    if (!applyFaqs && !applyServices && !applyTone) {
      toast({
        title: 'Select at least one option',
        description: 'Please select at least one type of data to apply',
        variant: 'destructive',
      });
      return;
    }
    applyMutation.mutate();
  };

  const hasExistingImport = latestImport?.import?.status === 'success' && latestImport.import.applied_at;

  if (hasExistingImport) {
    return (
      <Card className="border-green-500/50 border-solid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Phone History Imported
          </CardTitle>
          <CardDescription>
            Your phone history has been analyzed and applied to your business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Imported on {new Date(latestImport.import.applied_at).toLocaleDateString()}
            </div>
            {showSkip && (
              <Button variant="outline" size="sm" onClick={onComplete} data-testid="button-parser-continue">
                Continue
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (parserResult?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Analysis Complete
          </CardTitle>
          <CardDescription>
            Review and apply the extracted knowledge to your business
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <ListPlus className="w-5 h-5 text-blue-500" />
              <div>
                <div className="font-medium">{parserResult.preview?.servicesCount || 0}</div>
                <div className="text-xs text-muted-foreground">Services Found</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <MessageSquare className="w-5 h-5 text-green-500" />
              <div>
                <div className="font-medium">{parserResult.preview?.faqCount || 0}</div>
                <div className="text-xs text-muted-foreground">FAQs Extracted</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Brain className="w-5 h-5 text-purple-500" />
              <div>
                <div className="font-medium">
                  {parserResult.preview?.styleSnippets?.length ? 'Found' : 'None'}
                </div>
                <div className="text-xs text-muted-foreground">Tone Profile</div>
              </div>
            </div>
          </div>

          {parserResult.analytics?.conversations && (
            <Alert>
              <AlertTitle>Conversation Analytics</AlertTitle>
              <AlertDescription>
                Found {parserResult.analytics.conversations.total || 0} conversation threads
                {parserResult.analytics.conversations.avgLength
                  ? ` with an average of ${parserResult.analytics.conversations.avgLength.toFixed(1)} messages each`
                  : ''}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
            <h4 className="font-medium">Select what to apply:</h4>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListPlus className={`w-4 h-4 ${hasServices ? 'text-blue-500' : 'text-muted-foreground'}`} />
                <Label htmlFor="apply-services" className={!hasServices ? 'text-muted-foreground' : ''}>
                  Services ({parserResult.preview?.servicesCount || 0})
                  {!hasServices && <span className="ml-1 text-xs">(none found)</span>}
                </Label>
              </div>
              <Switch
                id="apply-services"
                checked={applyServices}
                onCheckedChange={setApplyServices}
                disabled={!hasServices}
                data-testid="switch-apply-services"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className={`w-4 h-4 ${hasFaqs ? 'text-green-500' : 'text-muted-foreground'}`} />
                <Label htmlFor="apply-faqs" className={!hasFaqs ? 'text-muted-foreground' : ''}>
                  FAQs ({parserResult.preview?.faqCount || 0})
                  {!hasFaqs && <span className="ml-1 text-xs">(none found)</span>}
                </Label>
              </div>
              <Switch
                id="apply-faqs"
                checked={applyFaqs}
                onCheckedChange={setApplyFaqs}
                disabled={!hasFaqs}
                data-testid="switch-apply-faqs"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className={`w-4 h-4 ${hasTone ? 'text-purple-500' : 'text-muted-foreground'}`} />
                <Label htmlFor="apply-tone" className={!hasTone ? 'text-muted-foreground' : ''}>
                  Tone Profile
                  {!hasTone && <span className="ml-1 text-xs">(none found)</span>}
                </Label>
              </div>
              <Switch
                id="apply-tone"
                checked={applyTone}
                onCheckedChange={setApplyTone}
                disabled={!hasTone}
                data-testid="switch-apply-tone"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleApply}
              disabled={applyMutation.isPending || (!applyFaqs && !applyServices && !applyTone)}
              className="flex-1"
              data-testid="button-apply-knowledge"
            >
              {applyMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Apply Knowledge
                </>
              )}
            </Button>
            {showSkip && (
              <Button variant="outline" onClick={onComplete} data-testid="button-parser-skip">
                Skip for Now
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Import Your Phone History
          <Badge variant="secondary" className="bg-purple-500/20 text-purple-700 dark:text-purple-300">
            Optional
          </Badge>
        </CardTitle>
        <CardDescription>
          Upload your exported SMS/call history and we'll extract services, FAQs, and communication style
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
        >
          <input
            type="file"
            multiple
            accept=".html,.csv,.zip,.json"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            data-testid="input-file-upload"
          />
          <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop files here, or click to select
          </p>
          <p className="text-xs text-muted-foreground">
            Supports: HTML (Google Messages export), CSV, ZIP, JSON
          </p>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Selected Files ({files.length})</Label>
            <div className="space-y-1">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-2 rounded bg-muted/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeFile(index)}
                    data-testid={`button-remove-file-${index}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {runParserMutation.isPending && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Analyzing files...</span>
            </div>
            <Progress value={undefined} className="h-2" />
          </div>
        )}

        {runParserMutation.isError && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>Analysis Failed</AlertTitle>
            <AlertDescription>
              {runParserMutation.error?.message || 'Failed to analyze files'}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || runParserMutation.isPending}
            className="flex-1"
            data-testid="button-analyze-files"
          >
            {runParserMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Analyze Files
              </>
            )}
          </Button>
          {showSkip && (
            <Button variant="outline" onClick={onComplete} data-testid="button-parser-skip">
              Skip
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Your files are processed securely and never stored after analysis
        </p>
      </CardContent>
    </Card>
  );
}

export default ParserImportStep;
