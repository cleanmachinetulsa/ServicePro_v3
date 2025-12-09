import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Upload, FileText, CheckCircle2, AlertCircle, Brain, ListPlus, MessageSquare, Sparkles, X, Wand2, Settings2, User, Shield, History, ChevronDown, Phone, Building2, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

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

interface BuildSetupResult {
  success: boolean;
  result?: {
    persona: {
      title: string;
      systemPrompt: string;
      toneWords: string[];
      formality: string;
      emojisAllowed: boolean;
      sampleGreeting?: string;
      sampleSignoff?: string;
    };
    services: { created: number; updated: number; skipped: number };
    faqs: { created: number; updated: number; skipped: number };
    tenantProfile: {
      appliedBusinessName?: string;
      appliedTagline?: string;
      appliedIndustry?: string;
      notes: string[];
    };
    warnings: string[];
  };
  error?: string;
}

interface ParserStatus {
  success: boolean;
  status: 'online' | 'degraded' | 'offline';
  healthy: boolean;
  lastError: string | null;
  isProtectedTenant: boolean;
  protectionMessage: string | null;
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
  const [applyPersona, setApplyPersona] = useState(true);
  const [buildSetupResult, setBuildSetupResult] = useState<BuildSetupResult | null>(null);
  
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [threadGapMinutes, setThreadGapMinutes] = useState(60);
  const [threadGapInput, setThreadGapInput] = useState('60');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const hasServices = (parserResult?.preview?.servicesCount || 0) > 0;
  const hasFaqs = (parserResult?.preview?.faqCount || 0) > 0;
  const hasTone = (parserResult?.preview?.styleSnippets?.length || 0) > 0;

  const initializeApplyToggles = (preview: ParserPreview | undefined) => {
    if (preview) {
      setApplyServices(preview.servicesCount > 0);
      setApplyFaqs(preview.faqCount > 0);
      setApplyTone((preview.styleSnippets?.length || 0) > 0);
      setApplyPersona(true);
    }
  };

  const { data: parserStatus, isLoading: statusLoading } = useQuery<ParserStatus>({
    queryKey: ['/api/onboarding/parser/status'],
    staleTime: 60000,
    retry: 1,
  });

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
      
      if (businessName.trim()) {
        formData.append('businessName', businessName.trim());
      }
      if (businessPhone.trim()) {
        formData.append('businessPhone', businessPhone.trim());
      }
      if (threadGapMinutes > 0) {
        formData.append('threadGapMinutes', String(threadGapMinutes));
      }

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

  const buildSetupMutation = useMutation({
    mutationFn: async () => {
      if (!parserResult?.importId) throw new Error('No import to build from');
      
      return apiRequest('POST', '/api/onboarding/parser/build-setup', {
        importId: parserResult.importId,
        applyServices,
        applyFaqs,
        applyPersona,
        applyProfile: true,
      }) as Promise<BuildSetupResult>;
    },
    onSuccess: (result) => {
      if (result.success && result.result) {
        setBuildSetupResult(result);
        const { services, faqs, persona } = result.result;
        toast({
          title: 'AI Setup Complete!',
          description: `Created ${services.created} services, ${faqs.created} FAQs, and configured AI persona`,
        });
      } else {
        toast({
          title: 'Build setup failed',
          description: result.error || 'Unknown error',
          variant: 'destructive',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/parser/latest'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Build setup error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleBuildSetup = () => {
    if (!applyFaqs && !applyServices && !applyPersona) {
      toast({
        title: 'Select at least one option',
        description: 'Please select at least one type of data to apply',
        variant: 'destructive',
      });
      return;
    }
    buildSetupMutation.mutate();
  };

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

  const getStatusBadge = () => {
    if (!parserStatus) return null;
    
    switch (parserStatus.status) {
      case 'online':
        return <Badge className="bg-green-500 text-white text-xs">Online</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500 text-white text-xs">Degraded</Badge>;
      default:
        return <Badge variant="destructive" className="text-xs">Offline</Badge>;
    }
  };

  if (statusLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (parserStatus?.isProtectedTenant) {
    return (
      <Card className="border-yellow-500/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-600" />
            Protected Tenant
          </CardTitle>
          <CardDescription>
            {parserStatus.protectionMessage || 'Parser onboarding is disabled for this tenant'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-3">
            <p>
              Your AI agent and services are already configured and running in production.
              This tool is designed for new tenant onboarding only.
            </p>
            <div className="flex gap-3">
              <Link href="/admin/parser-history">
                <Button variant="outline" size="sm" data-testid="button-view-history">
                  <History className="w-4 h-4 mr-2" />
                  View Import History
                </Button>
              </Link>
              {showSkip && (
                <Button variant="ghost" size="sm" onClick={onComplete} data-testid="button-parser-skip">
                  Continue
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (buildSetupResult?.success && buildSetupResult.result) {
    const { persona, services, faqs, tenantProfile, warnings } = buildSetupResult.result;
    
    return (
      <Card className="border-green-500/50 border-solid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            AI Setup Complete
          </CardTitle>
          <CardDescription>
            Your business has been configured based on your conversation history
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-purple-500" />
                <span className="font-medium">AI Persona</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="mb-1"><strong>Style:</strong> {persona.toneWords.slice(0, 3).join(', ')}</p>
                <p className="mb-1"><strong>Formality:</strong> {persona.formality}</p>
                {persona.sampleGreeting && (
                  <p className="text-xs italic mt-2">"{persona.sampleGreeting}"</p>
                )}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <ListPlus className="w-4 h-4 text-blue-500" />
                <span className="font-medium">Services</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>{services.created} created</p>
                {services.updated > 0 && <p>{services.updated} updated</p>}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-green-500" />
                <span className="font-medium">FAQs</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>{faqs.created} created</p>
                {faqs.updated > 0 && <p>{faqs.updated} updated</p>}
              </div>
            </div>

            {tenantProfile.notes.length > 0 && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Settings2 className="w-4 h-4 text-amber-500" />
                  <span className="font-medium">Business Profile</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {tenantProfile.notes.slice(0, 3).map((note, i) => (
                    <p key={i} className="text-xs">{note}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {warnings.length > 0 && (
            <Alert variant="default">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>Notes</AlertTitle>
              <AlertDescription>
                {warnings.map((w, i) => <p key={i} className="text-xs">{w}</p>)}
              </AlertDescription>
            </Alert>
          )}

          <Button onClick={onComplete} className="w-full" data-testid="button-setup-complete">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Continue to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

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

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-orange-500" />
                <Label htmlFor="apply-persona">
                  AI Persona & Behavior
                </Label>
              </div>
              <Switch
                id="apply-persona"
                checked={applyPersona}
                onCheckedChange={setApplyPersona}
                data-testid="switch-apply-persona"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleBuildSetup}
              disabled={buildSetupMutation.isPending || (!applyFaqs && !applyServices && !applyPersona)}
              className="flex-1"
              data-testid="button-build-setup"
            >
              {buildSetupMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Building Setup...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Build My Setup from This
                </>
              )}
            </Button>
            {showSkip && (
              <Button variant="outline" onClick={onComplete} data-testid="button-parser-skip">
                Don't Apply Now
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Your import results are saved - you can apply them later from Settings
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Your Existing Messages
            <Badge variant="secondary" className="bg-purple-500/20 text-purple-700 dark:text-purple-300">
              Optional
            </Badge>
          </CardTitle>
          {getStatusBadge()}
        </div>
        <CardDescription>
          We can analyze your past messages to learn your tone, common Q&A, and typical services
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            What we'll do with your files:
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
            <li>Learn your communication style and tone</li>
            <li>Extract FAQs from real customer conversations</li>
            <li>Identify services and pricing patterns</li>
            <li>Configure your AI agent to match your voice</li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
            <FileText className="w-4 h-4 text-green-500" />
            <span>Google Voice exports</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span>SMS backup files</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
            <FileText className="w-4 h-4 text-orange-500" />
            <span>HTML conversation logs</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
            <ListPlus className="w-4 h-4 text-purple-500" />
            <span>CSV price sheets</span>
          </div>
        </div>

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
            Supports: HTML, CSV, ZIP, JSON (up to 50MB)
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

        <Collapsible open={showAdvancedSettings} onOpenChange={setShowAdvancedSettings}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between px-2" data-testid="button-advanced-settings">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Settings2 className="w-4 h-4" />
                Advanced Settings
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4 border-t mt-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  Business Name
                </Label>
                <Input
                  id="businessName"
                  placeholder="e.g., Clean Machine Auto Detail"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  data-testid="input-business-name"
                />
                <p className="text-xs text-muted-foreground">
                  Helps the parser identify your messages vs customer messages
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessPhone" className="text-sm flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Business Phone Number
                </Label>
                <Input
                  id="businessPhone"
                  placeholder="e.g., +19185551234"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  data-testid="input-business-phone"
                />
                <p className="text-xs text-muted-foreground">
                  E.164 format (+1XXXXXXXXXX). Used to filter business-side messages
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="threadGap" className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Thread Gap (minutes)
                </Label>
                <Input
                  id="threadGap"
                  type="number"
                  min={15}
                  max={1440}
                  value={threadGapInput}
                  onChange={(e) => setThreadGapInput(e.target.value)}
                  onBlur={() => {
                    const parsed = parseInt(threadGapInput, 10);
                    if (isNaN(parsed) || threadGapInput.trim() === '') {
                      setThreadGapMinutes(60);
                      setThreadGapInput('60');
                    } else {
                      const clamped = Math.max(15, Math.min(1440, parsed));
                      setThreadGapMinutes(clamped);
                      setThreadGapInput(String(clamped));
                    }
                  }}
                  data-testid="input-thread-gap"
                />
                <p className="text-xs text-muted-foreground">
                  Messages separated by more than this time will be split into new conversations (15-1440 min, default: 60)
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

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
