import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MessageCircle, 
  Edit2, 
  Eye, 
  Save, 
  History, 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight,
  Sparkles 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SmsTemplate {
  id: number;
  templateKey: string;
  category: string;
  channel: string;
  language: string;
  name: string;
  description: string | null;
  body: string;
  variables: Array<{
    name: string;
    description: string;
    sample: string;
    required: boolean;
  }>;
  defaultPayload: Record<string, string>;
  enabled: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface TemplateVersion {
  id: number;
  templateId: number;
  version: number;
  body: string;
  variables: Array<{
    name: string;
    description: string;
    sample: string;
    required: boolean;
  }>;
  changeDescription: string | null;
  createdAt: string;
  createdBy: number | null;
}

interface CategoryGroup {
  category: string;
  templates: SmsTemplate[];
}

export function SmsTemplatesManager() {
  const { toast } = useToast();
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<SmsTemplate | null>(null);
  const [versionsTemplate, setVersionsTemplate] = useState<SmsTemplate | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string>>({});
  const [editForm, setEditForm] = useState({ body: '', changeDescription: '' });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch all templates
  const { data: templatesData, isLoading } = useQuery<{ success: boolean; templates: SmsTemplate[] }>({
    queryKey: ['/api/sms-templates'],
  });

  const templates = templatesData?.templates || [];

  // Group templates by category
  const groupedTemplates = templates.reduce<CategoryGroup[]>((acc, template) => {
    const existing = acc.find(g => g.category === template.category);
    if (existing) {
      existing.templates.push(template);
    } else {
      acc.push({ category: template.category, templates: [template] });
    }
    return acc;
  }, []);

  // Fetch versions for a specific template
  const { data: versionsData } = useQuery<{ success: boolean; versions: TemplateVersion[] }>({
    queryKey: ['/api/sms-templates', versionsTemplate?.id, 'versions'],
    enabled: !!versionsTemplate,
  });

  const versions = versionsData?.versions || [];

  // Preview template mutation
  const previewMutation = useMutation({
    mutationFn: async ({ key, payload }: { key: string; payload: Record<string, string> }) => {
      const res = await apiRequest('POST', `/api/sms-templates/${key}/preview`, { payload });
      return await res.json();
    },
    onError: (error: any) => {
      toast({
        title: 'Preview failed',
        description: error.message || 'Unable to generate preview',
        variant: 'destructive',
      });
    },
  });

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, body, changeDescription }: { id: number; body: string; changeDescription: string }) => {
      const res = await apiRequest('PUT', `/api/sms-templates/${id}`, { body, changeDescription });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: 'Template updated successfully', description: 'A new version has been saved.' });
      queryClient.invalidateQueries({ queryKey: ['/api/sms-templates'] });
      setEditingTemplate(null);
      setEditForm({ body: '', changeDescription: '' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update template', 
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    },
  });

  const handleEdit = (template: SmsTemplate) => {
    setEditingTemplate(template);
    setEditForm({ body: template.body, changeDescription: '' });
  };

  const handleSave = () => {
    if (!editingTemplate) return;
    updateMutation.mutate({
      id: editingTemplate.id,
      body: editForm.body,
      changeDescription: editForm.changeDescription,
    });
  };

  const handleVariableInsert = (variableName: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart || 0;
    const newBody = 
      editForm.body.slice(0, cursorPos) + 
      `{${variableName}}` + 
      editForm.body.slice(cursorPos);
    
    setEditForm({ ...editForm, body: newBody });
    
    // Restore cursor position after state update
    setTimeout(() => {
      const newCursorPos = cursorPos + variableName.length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const handlePreview = (template: SmsTemplate) => {
    setPreviewTemplate(template);
    setPreviewData(template.defaultPayload || {});
    // Don't auto-preview on open - let user click the button
  };

  const handlePreviewUpdate = () => {
    if (!previewTemplate) return;
    previewMutation.mutate({ key: previewTemplate.templateKey, payload: previewData });
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      booking: '📅',
      technician: '🔧',
      payment: '💳',
      referrals: '🎁',
    };
    return icons[category] || '📱';
  };

  const getCategoryLabel = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />
            SMS Templates
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Edit automatic SMS messages sent to customers. Changes are versioned for audit and rollback.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {templates.length} templates
        </Badge>
      </div>

      <div className="space-y-4">
        {groupedTemplates.map((group) => (
          <CategorySection
            key={group.category}
            category={group.category}
            templates={group.templates}
            icon={getCategoryIcon(group.category)}
            label={getCategoryLabel(group.category)}
            onEdit={handleEdit}
            onPreview={handlePreview}
            onViewVersions={(template) => setVersionsTemplate(template)}
          />
        ))}
      </div>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Template: {editingTemplate?.name}</DialogTitle>
            <DialogDescription>
              {editingTemplate?.description}
            </DialogDescription>
          </DialogHeader>
          
          {editingTemplate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-body">Message Template</Label>
                <Textarea
                  ref={textareaRef}
                  id="template-body"
                  data-testid="input-template-body"
                  value={editForm.body}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  rows={6}
                  className="font-mono text-sm"
                  placeholder="Enter template message..."
                />
                <p className="text-xs text-muted-foreground">
                  {editForm.body.length} characters
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Available Variables</Label>
                <div className="flex flex-wrap gap-2">
                  {editingTemplate.variables.map((variable) => (
                    <Badge
                      key={variable.name}
                      variant={variable.required ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => handleVariableInsert(variable.name)}
                      data-testid={`badge-variable-${variable.name}`}
                    >
                      {variable.name}
                      {variable.required && '*'}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Click a variable to insert it at cursor position. * = required
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="change-description">Change Description (Optional)</Label>
                <Input
                  id="change-description"
                  data-testid="input-change-description"
                  value={editForm.changeDescription}
                  onChange={(e) => setEditForm({ ...editForm, changeDescription: e.target.value })}
                  placeholder="What did you change in this version?"
                />
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setEditingTemplate(null)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={updateMutation.isPending || !editForm.body.trim()}
                  data-testid="button-save-template"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Template Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => {
        if (!open) {
          previewMutation.reset();
          setPreviewTemplate(null);
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              See how the message will look with sample data
            </DialogDescription>
          </DialogHeader>
          
          {previewTemplate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sample Data</Label>
                {previewTemplate.variables.map((variable) => (
                  <div key={variable.name} className="flex items-center gap-2">
                    <Label htmlFor={`preview-${variable.name}`} className="w-32 text-sm">
                      {variable.name}
                      {variable.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      id={`preview-${variable.name}`}
                      data-testid={`input-preview-${variable.name}`}
                      value={previewData[variable.name] || ''}
                      onChange={(e) => setPreviewData({ ...previewData, [variable.name]: e.target.value })}
                      placeholder={variable.sample}
                    />
                  </div>
                ))}
              </div>

              <Button
                onClick={handlePreviewUpdate}
                disabled={previewMutation.isPending}
                variant="secondary"
                size="sm"
                className="w-full"
                data-testid="button-update-preview"
              >
                <Eye className="h-4 w-4 mr-2" />
                Update Preview
              </Button>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Preview Output</Label>
                <Card>
                  <CardContent className="pt-6">
                    {previewMutation.data?.renderedMessage ? (
                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm whitespace-pre-wrap">{previewMutation.data.renderedMessage}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          {previewMutation.data.renderedMessage.length} characters
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">
                        Click "Update Preview" to see the rendered message
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {previewMutation.error && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">Preview Error</p>
                    <p className="text-xs">{(previewMutation.error as any)?.message || 'Failed to generate preview'}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={!!versionsTemplate} onOpenChange={(open) => !open && setVersionsTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Version History: {versionsTemplate?.name}</DialogTitle>
            <DialogDescription>
              View all changes made to this template
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {versions.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No version history available
                </div>
              ) : (
                versions.map((version) => (
                  <Card key={version.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm">Version {version.version}</CardTitle>
                          <CardDescription className="text-xs">
                            {new Date(version.createdAt).toLocaleString()}
                          </CardDescription>
                        </div>
                        {version.changeDescription && (
                          <Badge variant="outline" className="text-xs">
                            {version.changeDescription}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/50 rounded-md p-3">
                        <p className="text-xs font-mono whitespace-pre-wrap">{version.body}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CategorySectionProps {
  category: string;
  templates: SmsTemplate[];
  icon: string;
  label: string;
  onEdit: (template: SmsTemplate) => void;
  onPreview: (template: SmsTemplate) => void;
  onViewVersions: (template: SmsTemplate) => void;
}

function CategorySection({ category, templates, icon, label, onEdit, onPreview, onViewVersions }: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="w-full" data-testid={`collapsible-trigger-${category}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-2xl">{icon}</span>
                <div className="text-left">
                  <h3 className="text-lg font-semibold">{label}</h3>
                  <p className="text-xs text-muted-foreground">{templates.length} templates</p>
                </div>
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {templates.map((template) => (
              <Card key={template.id} className="border-l-4 border-l-primary/20" data-testid={`card-template-${template.templateKey}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-sm flex items-center gap-2" data-testid={`text-template-name-${template.templateKey}`}>
                        {template.name}
                        {!template.enabled && (
                          <Badge variant="secondary" className="text-xs">Disabled</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {template.description}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onPreview(template)}
                        data-testid={`button-preview-${template.templateKey}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(template)}
                        data-testid={`button-edit-${template.templateKey}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onViewVersions(template)}
                        data-testid={`button-versions-${template.templateKey}`}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="bg-muted/50 rounded-md p-3">
                      <p className="text-xs font-mono whitespace-pre-wrap">{template.body}</p>
                    </div>
                    {template.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.variables.map((variable) => (
                          <Badge key={variable.name} variant="outline" className="text-xs">
                            {variable.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
